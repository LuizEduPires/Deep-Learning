"""Serviço HTTP pequeno para inferir doenças em cladódios de pitaia."""

from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path
from urllib.parse import urlparse

import numpy as np
import onnxruntime as ort
from PIL import Image


HERE = Path(__file__).resolve().parent
MODEL_PATH = HERE / "classificador_pitaia.onnx"
LABELS_PATH = HERE / "classes_pt-BR.json"
IMAGE_SIZE = 224
MAX_IMAGE_MB = int(os.environ.get("MAX_IMAGE_MB", "20"))
MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024
MAX_IMAGE_PIXELS = 40_000_000
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS

with LABELS_PATH.open(encoding="utf-8") as labels_file:
    MODEL_INFO = json.load(labels_file)

CLASS_NAMES = [
    item["label"] for item in sorted(MODEL_INFO["classes"], key=lambda item: item["index"])
]
MEAN = np.asarray(MODEL_INFO["input"]["normalization"]["mean"], dtype=np.float32)
STD = np.asarray(MODEL_INFO["input"]["normalization"]["std"], dtype=np.float32)

session_options = ort.SessionOptions()
session_options.intra_op_num_threads = int(os.environ.get("ORT_THREADS", "2"))
session_options.inter_op_num_threads = 1
session_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
SESSION = ort.InferenceSession(
    str(MODEL_PATH),
    sess_options=session_options,
    providers=["CPUExecutionProvider"],
)
INPUT_NAME = SESSION.get_inputs()[0].name
OUTPUT_NAME = SESSION.get_outputs()[0].name
if (
    len(CLASS_NAMES) != 10
    or len(SESSION.get_outputs()) != 1
    or SESSION.get_inputs()[0].shape != [1, 3, IMAGE_SIZE, IMAGE_SIZE]
    or SESSION.get_outputs()[0].shape != [1, len(CLASS_NAMES)]
):
    raise RuntimeError("O mapa de classes ou as saídas do modelo não são compatíveis.")


def preprocess(image_bytes: bytes) -> np.ndarray:
    with Image.open(BytesIO(image_bytes)) as image:
        if image.width * image.height > MAX_IMAGE_PIXELS:
            raise ValueError("A imagem excede o limite de pixels.")
        image = image.convert("RGB").resize(
            (IMAGE_SIZE, IMAGE_SIZE), Image.Resampling.BILINEAR
        )
        pixels = np.asarray(image, dtype=np.float32) / np.float32(255.0)

    normalized = (pixels - MEAN) / STD
    return np.transpose(normalized, (2, 0, 1))[None, ...].astype(np.float32, copy=False)


def classify(image_bytes: bytes) -> dict:
    tensor = preprocess(image_bytes)
    logits = SESSION.run([OUTPUT_NAME], {INPUT_NAME: tensor})[0][0].astype(np.float64)
    logits -= np.max(logits)
    probabilities = np.exp(logits)
    probabilities /= probabilities.sum()
    order = np.argsort(probabilities)[::-1][:3]
    return {
        "modelo": MODEL_INFO["model"],
        "classe": CLASS_NAMES[int(order[0])],
        "confianca": round(float(probabilities[order[0]]), 6),
        "top_3": [
            {
                "classe": CLASS_NAMES[int(index)],
                "probabilidade": round(float(probabilities[index]), 6),
            }
            for index in order
        ],
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "PitayaLeafClassifier/1.0"

    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if urlparse(self.path).path != "/healthz":
            self._send_json(404, {"erro": "Rota não encontrada."})
            return
        self._send_json(
            200,
            {"status": "ok", "modelo": MODEL_INFO["model"], "classes": len(CLASS_NAMES)},
        )

    def do_POST(self) -> None:
        if urlparse(self.path).path != "/classificar":
            self._send_json(404, {"erro": "Rota não encontrada."})
            return

        content_type = self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
        supported_types = {
            "image/jpeg", "image/jpg", "image/png", "image/webp", "image/bmp",
            "image/tiff",
        }
        if content_type not in supported_types:
            self._send_json(415, {"erro": "Envie JPEG, PNG, WebP, BMP ou TIFF."})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._send_json(400, {"erro": "Content-Length inválido."})
            return
        if content_length <= 0:
            self._send_json(400, {"erro": "O corpo da requisição está vazio."})
            return
        if content_length > MAX_IMAGE_BYTES:
            self._send_json(413, {"erro": f"O limite é {MAX_IMAGE_MB} MiB."})
            return

        image_bytes = self.rfile.read(content_length)
        if len(image_bytes) != content_length:
            self._send_json(400, {"erro": "A imagem recebida está incompleta."})
            return
        try:
            result = classify(image_bytes)
        except (OSError, ValueError, Image.DecompressionBombError) as exc:
            self._send_json(422, {"erro": f"Não foi possível ler a imagem: {exc}"})
            return
        except Exception:
            self.log_error("Falha interna durante a inferência")
            self._send_json(500, {"erro": "Falha ao classificar a imagem."})
            return
        self._send_json(200, result)

    def log_message(self, format: str, *args: object) -> None:
        # Loga método e status sem registrar conteúdo ou bytes da imagem.
        super().log_message(format, *args)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"Classificador disponível na porta {port}; classes: {len(CLASS_NAMES)}")
    server.serve_forever()
