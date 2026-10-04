"use client";

import { useEffect, useRef, useState } from "react";
import { anunciarUsuario, sair, usarUsuario, type Usuario } from "./usuario";
import {
  CabecalhoPagina,
  Campo,
  Icone,
  TituloSecao,
  classeBotaoContorno,
  classeBotaoPrimario,
  classeCartao,
} from "./ui";

type Mensagem = { tipo: "ok" | "erro"; texto: string } | null;

function Aviso({ msg }: { msg: Mensagem }) {
  if (!msg) return null;
  return (
    <p
      role={msg.tipo === "erro" ? "alert" : "status"}
      className={`text-sm ${msg.tipo === "ok" ? "text-marca-texto" : "text-acento-texto"}`}
    >
      {msg.texto}
    </p>
  );
}

async function enviar(url: string, metodo: string, corpo: unknown) {
  const res = await fetch(url, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Não consegui salvar.");
  return data;
}

/** Aba de conta: dados do usuário, troca de nome e de senha, e sair. */
export default function Conta() {
  const usuario = usarUsuario();
  const [saindo, setSaindo] = useState(false);

  const [nome, setNome] = useState("");
  const [salvandoNome, setSalvandoNome] = useState(false);
  const [msgNome, setMsgNome] = useState<Mensagem>(null);

  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [msgSenha, setMsgSenha] = useState<Mensagem>(null);
  const [senhaTrocada, setSenhaTrocada] = useState(false);
  const janelaSenha = useRef<HTMLDialogElement>(null);

  function abrirJanelaSenha() {
    setSenhaAtual("");
    setNovaSenha("");
    setConfirmacao("");
    setMsgSenha(null);
    setSenhaTrocada(false);
    janelaSenha.current?.showModal();
  }

  // Preenche o campo com o nome salvo quando ele chega.
  useEffect(() => {
    if (usuario) setNome(usuario.name);
  }, [usuario]);

  async function salvarNome(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      setMsgNome({ tipo: "erro", texto: "Informe um nome." });
      return;
    }
    setSalvandoNome(true);
    setMsgNome(null);
    try {
      anunciarUsuario((await enviar("/api/auth/eu", "PATCH", { name: nome.trim() })) as Usuario);
      setMsgNome({ tipo: "ok", texto: "Nome atualizado." });
    } catch (err) {
      setMsgNome({ tipo: "erro", texto: err instanceof Error ? err.message : String(err) });
    } finally {
      setSalvandoNome(false);
    }
  }

  async function salvarSenha(e: React.FormEvent) {
    e.preventDefault();
    if (novaSenha.length < 8) {
      setMsgSenha({ tipo: "erro", texto: "A nova senha precisa ter pelo menos 8 caracteres." });
      return;
    }
    if (novaSenha !== confirmacao) {
      setMsgSenha({ tipo: "erro", texto: "A confirmação não é igual à nova senha." });
      return;
    }
    setSalvandoSenha(true);
    setMsgSenha(null);
    try {
      await enviar("/api/auth/senha", "POST", { senhaAtual, novaSenha });
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmacao("");
      setSenhaTrocada(true);
      janelaSenha.current?.close();
    } catch (err) {
      setMsgSenha({ tipo: "erro", texto: err instanceof Error ? err.message : String(err) });
    } finally {
      setSalvandoSenha(false);
    }
  }

  const nomeMudou = usuario ? nome.trim() !== usuario.name : false;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-5 pt-6 pb-8 md:px-8 md:pt-8">
      <CabecalhoPagina titulo="Minha conta" apoio="Suas conversas e sua propriedade ficam nesta conta." />

      <section className={`${classeCartao} flex items-center gap-4 p-5`}>
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-marca-suave font-display text-[22px] font-bold text-marca-texto">
          {usuario ? usuario.name.trim().charAt(0).toUpperCase() : <Icone nome="usuario" className="h-6 w-6" />}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[17px] font-bold">{usuario ? usuario.name : "Carregando…"}</p>
          <p className="truncate text-[15px] text-suave">{usuario?.email ?? " "}</p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <TituloSecao>Nome</TituloSecao>
        <form onSubmit={salvarNome} className={`${classeCartao} flex flex-col gap-3 p-4`}>
          <Campo rotulo="Como quer ser chamado" valor={nome} aoMudar={setNome} nome="name" autoComplete="name" obrigatorio />
          <Aviso msg={msgNome} />
          <button type="submit" disabled={!usuario || !nomeMudou || salvandoNome} className={classeBotaoPrimario}>
            {salvandoNome ? "Salvando…" : "Salvar nome"}
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <TituloSecao>Segurança</TituloSecao>
        <button type="button" disabled={!usuario} onClick={abrirJanelaSenha} className={classeBotaoContorno}>
          <Icone nome="escudo" className="h-[18px] w-[18px]" />
          Trocar senha
        </button>
        {senhaTrocada && (
          <p role="status" className="text-sm text-marca-texto">
            Senha trocada. Os outros aparelhos conectados precisarão entrar de novo.
          </p>
        )}
      </section>

      <dialog
        ref={janelaSenha}
        aria-labelledby="titulo-janela-senha"
        className="m-auto w-[calc(100%-32px)] max-w-md rounded-[20px] border border-borda bg-painel p-0 text-texto backdrop:bg-black/50"
      >
        <form onSubmit={salvarSenha} className="flex flex-col gap-3 p-5">
          <div className="mb-1 flex items-center justify-between gap-3">
            <h2 id="titulo-janela-senha" className="font-display text-[19px] font-bold tracking-tight">
              Trocar senha
            </h2>
            <button
              type="button"
              onClick={() => janelaSenha.current?.close()}
              aria-label="Fechar"
              className="flex h-10 w-10 items-center justify-center rounded-full text-suave hover:bg-fundo"
            >
              <Icone nome="x" className="h-5 w-5" />
            </button>
          </div>
          {/* E-mail oculto para o gerenciador de senhas saber de qual conta é. */}
          <input type="email" name="email" autoComplete="username" value={usuario?.email ?? ""} readOnly hidden />
          <Campo
            rotulo="Senha atual"
            valor={senhaAtual}
            aoMudar={setSenhaAtual}
            tipo="password"
            nome="current-password"
            autoComplete="current-password"
            obrigatorio
          />
          <Campo
            rotulo="Nova senha"
            valor={novaSenha}
            aoMudar={setNovaSenha}
            tipo="password"
            dica="Pelo menos 8 caracteres"
            nome="new-password"
            autoComplete="new-password"
            obrigatorio
          />
          <Campo
            rotulo="Confirme a nova senha"
            valor={confirmacao}
            aoMudar={setConfirmacao}
            tipo="password"
            nome="confirm-password"
            autoComplete="new-password"
            obrigatorio
          />
          <Aviso msg={msgSenha} />
          <button type="submit" disabled={salvandoSenha} className={`${classeBotaoPrimario} mt-1`}>
            {salvandoSenha ? "Trocando…" : "Trocar senha"}
          </button>
        </form>
      </dialog>

      <button
        type="button"
        disabled={saindo || !usuario}
        onClick={() => {
          setSaindo(true);
          void sair();
        }}
        className={classeBotaoContorno}
      >
        <Icone nome="sair" className="h-[18px] w-[18px]" />
        {saindo ? "Saindo…" : "Sair da conta"}
      </button>
    </main>
  );
}
