import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  classificarImagemFolha,
  ErroClassificadorFolha,
  limparNomeArquivo,
  textoComAnalise,
  validarImagemFolha,
  validarPredicao,
  type FotoDeFolha,
} from "../src/server/classificador-folha";
import { lerCorpoChat, ErroEntradaChat } from "../src/server/chat-http";
import { montarMensagensDoChat } from "../src/server/mensagens-chat";
import { MAX_CORPO_CHAT_BYTES, MAX_FOLHA_BYTES } from "../src/shared/classificador-folha";
import type { LeafInference } from "../src/shared/classificador-folha";

const fetchOriginal = globalThis.fetch;
const urlOriginal = process.env.CLASSIFICADOR_FOLHA_URL;

afterEach(() => {
  globalThis.fetch = fetchOriginal;
  if (urlOriginal === undefined) delete process.env.CLASSIFICADOR_FOLHA_URL;
  else process.env.CLASSIFICADOR_FOLHA_URL = urlOriginal;
});

function predicaoSobControle() {
  return {
    modelo: "MobileNetV3-Small",
    classe: "Antracnose",
    confianca: 0.7,
    top_3: [
      { classe: "Antracnose", probabilidade: 0.7 },
      { classe: "Podridão mole", probabilidade: 0.2 },
      { classe: "Saudável", probabilidade: 0.1 },
    ],
  };
}

const fotoBasica: FotoDeFolha = {
  bytes: Uint8Array.from([1, 2, 3]),
  tipo: "image/jpeg",
  nomeArquivo: "folha.jpg",
};

test("aceita e registra a previsão do modelo e envia somente os bytes à API local", async () => {
  process.env.CLASSIFICADOR_FOLHA_URL = "http://classificador-folha:8080/";
  let endereco = "";
  let opcoes: RequestInit | undefined;
  globalThis.fetch = (async (input, init) => {
    endereco = String(input);
    opcoes = init;
    return Response.json(predicaoSobControle());
  }) as typeof fetch;

  const resultado = await classificarImagemFolha(fotoBasica);
  assert.equal(endereco, "http://classificador-folha:8080/classificar");
  assert.equal(opcoes?.method, "POST");
  assert.equal(opcoes?.headers && (opcoes.headers as Record<string, string>)["Content-Type"], "image/jpeg");
  assert.equal((opcoes?.signal as AbortSignal).aborted, false);
  assert.deepEqual(new Uint8Array(opcoes?.body as ArrayBuffer), fotoBasica.bytes);
  assert.equal(resultado.nomeArquivo, "folha.jpg");
  assert.equal(resultado.classe, "Antracnose");
  assert.equal(resultado.top_3.length, 3);
});

test("descarta campos, rótulos, pontuações e ordens inválidas do serviço", () => {
  const resultado = predicaoSobControle();
  assert.equal(validarPredicao(resultado).success, true);
  assert.equal(validarPredicao({ ...resultado, classe: "Doença inventada" }).success, false);
  assert.equal(validarPredicao({ ...resultado, confianca: 0.99 }).success, false);
  assert.equal(validarPredicao({ ...resultado, top_3: [resultado.top_3[0], resultado.top_3[0], resultado.top_3[2]] }).success, false);
  assert.equal(validarPredicao({ ...resultado, campo_extra: "ignorado pelo contrato" }).success, false);
});

test("transforma formato recusado, JSON inválido e serviço indisponível em erros acionáveis", async () => {
  assert.match(validarImagemFolha({ type: "application/pdf", size: 10 } as File)!, /Formato não aceito/);
  assert.match(validarImagemFolha({ type: "image/png", size: 0 } as File)!, /vazia/);
  assert.match(validarImagemFolha({ type: "image/jpeg", size: MAX_FOLHA_BYTES + 1 } as File)!, /20 MiB/);

  globalThis.fetch = (async () => new Response("{}", { status: 415 })) as typeof fetch;
  await assert.rejects(
    classificarImagemFolha(fotoBasica),
    (error: unknown) => error instanceof ErroClassificadorFolha && error.status === 415,
  );

  globalThis.fetch = (async () => new Response("{}", { status: 422 })) as typeof fetch;
  await assert.rejects(
    classificarImagemFolha(fotoBasica),
    (error: unknown) => error instanceof ErroClassificadorFolha && error.status === 422,
  );

  globalThis.fetch = (async () => Response.json({ results: "unrecognized" })) as typeof fetch;
  await assert.rejects(
    classificarImagemFolha(fotoBasica),
    (error: unknown) => error instanceof ErroClassificadorFolha && error.message.includes("resultado inválido"),
  );

  globalThis.fetch = (async () => { throw new TypeError("network down"); }) as typeof fetch;
  await assert.rejects(
    classificarImagemFolha(fotoBasica),
    (error: unknown) => error instanceof ErroClassificadorFolha && error.status === 503,
  );
});

test("não trata erro de timeout como uma resposta parcial de diagnóstico", async () => {
  const metodoOriginal = AbortSignal.timeout;
  Object.defineProperty(AbortSignal, "timeout", {
    configurable: true,
    value: () => AbortSignal.abort(new DOMException("Tempo esgotado", "TimeoutError")),
  });
  globalThis.fetch = (async () => {
    const erro = new Error("aborted");
    erro.name = "AbortError";
    throw erro;
  }) as typeof fetch;
  try {
    await assert.rejects(
      classificarImagemFolha(fotoBasica),
      (error: unknown) => error instanceof ErroClassificadorFolha && error.status === 504,
    );
  } finally {
    Object.defineProperty(AbortSignal, "timeout", { configurable: true, value: metodoOriginal });
  }
});

test("só dá texto ao modelo e reanexa a análise salva nas perguntas futuras", () => {
  const predicao = validarPredicao(predicaoSobControle());
  if (!predicao.success) throw predicao.error;
  const analise: LeafInference = {
    ...predicao.data,
    nomeArquivo: "C:\\private\\folha.jpg",
  };
  const mensagem = textoComAnalise("O que devo fazer?", analise);
  const seguimento = textoComAnalise("E como confirmo?", analise);
  assert.match(mensagem, /Antracnose \(70\.0%\)/);
  assert.match(mensagem, /não a imagem/i);
  assert.match(mensagem, /não infira que a planta está saudável/i);
  assert.match(seguimento, /saudável/i);
  assert.doesNotMatch(mensagem, /private|folha\.jpg|base64/i);
  assert.equal(textoComAnalise("Pergunta sem imagem"), "Pergunta sem imagem");
  assert.equal(limparNomeArquivo("../../pin\r\ntexto.jpg"), "pin__texto.jpg");

  const mensagens = montarMensagensDoChat(
    [
      { role: "user", content: "O que devo fazer?", leafInference: analise },
      { role: "assistant", content: "Consulte a base técnica." },
    ],
    "E como confirmo?",
  );
  assert.equal(mensagens.length, 3);
  assert.match(mensagens[0].content, /Antracnose \(70\.0%\)/);
  assert.equal(mensagens[1].content, "Consulte a base técnica.");
  assert.match(mensagens[2].content, /E como confirmo\?/);
  assert.equal(mensagens[2].content, "E como confirmo?");
  assert.doesNotMatch(JSON.stringify(mensagens), /private|folha\.jpg|base64/i);
});

test("mantém o contrato JSON e permite uma única foto em multipart", async () => {
  const json = await lerCorpoChat(new Request("http://pitaya.test/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Converse sobre o manejo" }),
  }));
  assert.deepEqual(json, { message: "Converse sobre o manejo" });

  const formulario = new FormData();
  formulario.append("image", new File([Uint8Array.of(1, 2)], "folha.jpg", { type: "image/jpeg" }));
  formulario.append("message", "O que é isso?");
  const multipart = await lerCorpoChat(new Request("http://pitaya.test/api/chat", {
    method: "POST",
    body: formulario,
  }));
  assert.equal(multipart.message, "O que é isso?");
  assert.equal(multipart.foto?.tipo, "image/jpeg");
  assert.deepEqual(multipart.foto?.bytes, Uint8Array.of(1, 2));
  assert.equal(multipart.foto?.nomeArquivo, "folha.jpg");

  const somenteFoto = new FormData();
  somenteFoto.append("image", new File([Uint8Array.of(1)], "folha.png", { type: "image/png" }));
  const perguntaPadrao = await lerCorpoChat(new Request("http://pitaya.test/api/chat", {
    method: "POST",
    body: somenteFoto,
  }));
  assert.equal(perguntaPadrao.message, "Analise esta folha de pitaya e explique o resultado.");
});

test("rejeita imagens duplicadas e corpos maiores que o limite inclusive via stream", async () => {
  const formulario = new FormData();
  formulario.append("image", new File(["a"], "uma.jpg", { type: "image/jpeg" }));
  formulario.append("image", new File(["b"], "duas.jpg", { type: "image/jpeg" }));
  await assert.rejects(
    lerCorpoChat(new Request("http://pitaya.test/api/chat", { method: "POST", body: formulario })),
    (error: unknown) => error instanceof ErroEntradaChat && error.status === 400,
  );

  const excedente = new Request("http://pitaya.test/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Content-Length": String(MAX_CORPO_CHAT_BYTES + 1) },
    body: "{}",
  });
  await assert.rejects(
    lerCorpoChat(excedente),
    (error: unknown) => error instanceof ErroEntradaChat && error.status === 413,
  );

  const corpoChunked = new Request("http://pitaya.test/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: new ReadableStream({
      start(controlador) {
        controlador.enqueue(new Uint8Array(MAX_CORPO_CHAT_BYTES + 1));
        controlador.close();
      },
    }),
    duplex: "half",
  } as RequestInit);
  await assert.rejects(
    lerCorpoChat(corpoChunked),
    (error: unknown) => error instanceof ErroEntradaChat && error.status === 413,
  );
});
