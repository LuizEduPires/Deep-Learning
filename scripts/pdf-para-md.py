"""
Converte os PDFs de Rag/ em .md dentro de data/conhecimento/, no formato que
scripts/ingest.ts espera (primeira linha "# Título", uma linha "Fonte: ...").

    npm run rag:pdf && npm run db:seed

Fica em Python porque pypdf já está instalado na máquina; a alternativa seria
somar uma dependência de parsing de PDF ao projeto só para este passo.

PDFs escaneados (sem camada de texto) são pulados e listados no fim — esses
precisam de OCR antes de entrar na base.
"""
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path

from pypdf import PdfReader

# O console do Windows abre em cp1252 e quebra ao imprimir acento.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ORIGEM = Path("Rag")
DESTINO = Path("data/conhecimento")
MIN_CHARS_POR_PAGINA = 100

# O título vira a citação exibida ao produtor na resposta do chat, então não
# pode sair do nome do arquivo nem do metadado do PDF — que trazem coisas como
# "53d1ce9c6f19bc..." e "Capa Pitaya5 para incluir no miolo.indd". Estes foram
# lidos da primeira página de cada documento.
TITULOS = {
    "53d1ce9c6f19bc3015a87baf55f55b406bd1.pdf":
        "Pitaia, da propagação à colheita: uma revisão (Pollnow)",
    "livropitaya-versaofinalweb.pdf":
        "Pitaya: uma alternativa frutífera (Arbués, 2022)",
    "lamperuch,+BT+196_+Cultivo+de+pitaia.pdf":
        "Cultivo de Pitaia — Boletim Técnico 196 (Lone et al.)",
    "cartilha_cultivo_da_pitaya_v3.pdf":
        "Cultivo da Pitaya — cartilha",
    "Manejo de Pragas e Doenças na Pitaya.pdf":
        "Manejo de Pragas e Doenças na Pitaya",
}


def slug(texto: str) -> str:
    t = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    t = re.sub(r"[^\w\s-]", "", t).strip().lower()
    return re.sub(r"[\s_]+", "-", t)[:60].strip("-")


def repetidas(paginas: list[str], limite: float = 0.5) -> set[str]:
    """Cabeçalho e rodapé aparecem na maioria das páginas; conteúdo não."""
    if len(paginas) < 4:
        return set()
    c = Counter()
    for p in paginas:
        for linha in {l.strip() for l in p.split("\n") if len(l.strip()) > 3}:
            c[linha] += 1
    corte = len(paginas) * limite
    return {linha for linha, n in c.items() if n >= corte}


def limpar(paginas: list[str]) -> str:
    lixo = repetidas(paginas)
    texto = "\n".join(paginas)
    # Palavra quebrada por hífen no fim da linha.
    texto = re.sub(r"-\n(?=[a-záéíóúàâêôãõç])", "", texto)

    paragrafos: list[str] = []
    buffer = ""
    for linha in (l.strip() for l in texto.split("\n")):
        if not linha or linha in lixo or re.fullmatch(r"[\d\s|—-]{1,6}", linha):
            if buffer:
                paragrafos.append(buffer)
                buffer = ""
            continue
        # Linha anterior sem pontuação final: mesma frase, quebrada pelo layout.
        if buffer and not re.search(r"[.:;!?]$", buffer):
            buffer += " " + linha
        else:
            if buffer:
                paragrafos.append(buffer)
            buffer = linha
    if buffer:
        paragrafos.append(buffer)

    return "\n\n".join(p for p in paragrafos if len(p) > 40)


def main() -> int:
    if not ORIGEM.is_dir():
        print(f"Pasta não encontrada: {ORIGEM.resolve()}")
        return 1
    DESTINO.mkdir(parents=True, exist_ok=True)

    pdfs = sorted(ORIGEM.glob("*.pdf"))
    if not pdfs:
        print(f"Nenhum PDF em {ORIGEM.resolve()}")
        return 1

    escaneados: list[str] = []
    for pdf in pdfs:
        leitor = PdfReader(str(pdf))
        paginas = [(p.extract_text() or "") for p in leitor.pages]
        total = sum(len(p) for p in paginas)

        if total / max(len(paginas), 1) < MIN_CHARS_POR_PAGINA:
            escaneados.append(pdf.name)
            print(f"[pulado]  {pdf.name} — sem camada de texto, pulado (precisa de OCR)")
            continue

        meta = (leitor.metadata or {}).get("/Title") or ""
        titulo = (
            TITULOS.get(pdf.name)
            or str(meta).strip()
            or re.sub(r"[_+]+", " ", pdf.stem).strip()
        )
        corpo = limpar(paginas)

        destino = DESTINO / f"rag-{slug(pdf.stem)}.md"
        destino.write_text(
            f"# {titulo}\n\nFonte: {pdf.name} (PDF em Rag/)\n\n{corpo}\n",
            encoding="utf-8",
            newline="\n",
        )
        print(f"[ok]      {destino.name} — {len(leitor.pages)} pág., {len(corpo)} chars")

    if escaneados:
        print("\nPrecisam de OCR antes de entrar na base:")
        for nome in escaneados:
            print(f"  - {nome}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
