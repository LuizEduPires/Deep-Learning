"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Ditado por voz usando a Web Speech API do próprio navegador.
 *
 * A transcrição acontece no navegador, sem passar por LLM e sem custo por
 * minuto: o áudio nunca chega ao nosso servidor. Em troca, o suporte varia —
 * Chrome e Edge implementam, o Firefox não — então a interface só oferece o
 * microfone quando `suportado` for verdadeiro.
 *
 * Exige contexto seguro (https ou localhost). Em http de rede local o
 * construtor existe mas start() falha com "not-allowed", e é por isso que a
 * mensagem de permissão negada também cita o protocolo.
 */

interface ResultadoFala {
  readonly isFinal: boolean;
  readonly length: number;
  [indice: number]: { readonly transcript: string };
}

interface EventoResultado {
  readonly resultIndex: number;
  readonly results: { readonly length: number; [i: number]: ResultadoFala };
}

interface EventoErro {
  readonly error: string;
}

interface ReconhecimentoDeFala {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: EventoResultado) => void) | null;
  onerror: ((e: EventoErro) => void) | null;
  onend: (() => void) | null;
}

type Construtor = new () => ReconhecimentoDeFala;

/**
 * O prefixo webkit ainda é o que responde no Chrome e no Edge. Lido por
 * indexação em vez de `declare global` para não colidir com a tipagem que o
 * lib.dom possa já trazer.
 */
function construtorDisponivel(): Construtor | null {
  if (typeof window === "undefined") return null;
  const janela = window as unknown as Record<string, Construtor | undefined>;
  return janela.SpeechRecognition ?? janela.webkitSpeechRecognition ?? null;
}

function mensagemDeErro(codigo: string): string {
  switch (codigo) {
    case "not-allowed":
    case "service-not-allowed":
      return "Permissão de microfone negada. Libere o acesso no cadeado da barra de endereço — em rede local, o navegador só permite por https ou localhost.";
    case "audio-capture":
      return "Nenhum microfone encontrado. Verifique se ele está conectado.";
    case "no-speech":
      return "Não ouvi nada. Toque no microfone e fale mais perto.";
    case "network":
      return "O reconhecimento de fala do navegador não conseguiu se conectar. Verifique a internet.";
    case "aborted":
      return "";
    default:
      return `Não consegui capturar o áudio (${codigo}).`;
  }
}

/**
 * Erros que significam "sem acesso ao microfone" — os únicos que trocam o
 * ícone. Falha de rede ou silêncio não dizem nada sobre a permissão.
 */
function semAcesso(codigo: string): boolean {
  return (
    codigo === "not-allowed" ||
    codigo === "service-not-allowed" ||
    codigo === "audio-capture"
  );
}

export type Ditado = {
  /** false quando o navegador não implementa a API — esconda o botão. */
  suportado: boolean;
  gravando: boolean;
  /** Acesso negado ou microfone ausente — troque o ícone pelo de alerta. */
  bloqueado: boolean;
  /** Trecho ainda não confirmado, para dar retorno visual enquanto fala. */
  parcial: string;
  erro: string;
  alternar: () => void;
};

export function usarDitado(aoTranscrever: (texto: string) => void): Ditado {
  const [suportado, setSuportado] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const [parcial, setParcial] = useState("");
  const [erro, setErro] = useState("");
  const reconhecimento = useRef<ReconhecimentoDeFala | null>(null);

  // A referência evita recriar o reconhecimento a cada tecla digitada, o que
  // interromperia a gravação em andamento.
  const aoTranscreverRef = useRef(aoTranscrever);
  useEffect(() => {
    aoTranscreverRef.current = aoTranscrever;
  }, [aoTranscrever]);

  useEffect(() => {
    const Construtor = construtorDisponivel();
    if (!Construtor) return;

    const r = new Construtor();
    r.lang = "pt-BR";
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onresult = (e) => {
      // Chegou áudio: o acesso está valendo, mesmo que antes tenha falhado.
      setBloqueado(false);

      let confirmado = "";
      let emAndamento = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const resultado = e.results[i];
        const trecho = resultado[0].transcript;
        if (resultado.isFinal) confirmado += trecho;
        else emAndamento += trecho;
      }
      setParcial(emAndamento);
      if (confirmado.trim()) {
        setErro("");
        aoTranscreverRef.current(confirmado.trim());
      }
    };

    r.onerror = (e) => {
      const msg = mensagemDeErro(e.error);
      if (msg) setErro(msg);
      if (semAcesso(e.error)) setBloqueado(true);
      setGravando(false);
      setParcial("");
    };

    r.onend = () => {
      setGravando(false);
      setParcial("");
    };

    reconhecimento.current = r;
    setSuportado(true);

    return () => {
      r.onresult = null;
      r.onerror = null;
      r.onend = null;
      r.abort();
    };
  }, []);

  /**
   * O Permissions API entrega o estado antes de qualquer tentativa, então quem
   * já bloqueou o microfone vê o ícone de alerta assim que a tela abre. Nem
   * todo navegador expõe "microphone" aqui — quando não expõe, o estado só se
   * revela no onerror.
   */
  useEffect(() => {
    const permissoes = navigator.permissions;
    if (!permissoes?.query) return;

    let ativo = true;
    let status: PermissionStatus | null = null;

    permissoes
      .query({ name: "microphone" as PermissionName })
      .then((s) => {
        if (!ativo) return;
        status = s;
        const aplicar = () => setBloqueado(s.state === "denied");
        s.onchange = aplicar;
        aplicar();
      })
      .catch(() => {});

    return () => {
      ativo = false;
      if (status) status.onchange = null;
    };
  }, []);

  const alternar = useCallback(() => {
    const r = reconhecimento.current;
    if (!r) return;

    if (gravando) {
      r.stop();
      return;
    }

    setErro("");
    setParcial("");
    try {
      r.start();
      setGravando(true);
    } catch {
      // start() lança se já houver uma sessão ativa; o estado se corrige no
      // onend, então basta não derrubar a interface.
      setGravando(false);
    }
  }, [gravando]);

  return { suportado, gravando, bloqueado, parcial, erro, alternar };
}
