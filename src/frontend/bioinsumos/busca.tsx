"use client";

import { Fragment, useCallback, useEffect, useState } from "react";

type Produto = {
  numero_registro: string | null;
  nome: string;
  ingrediente_ativo: string | null;
  classe: string | null;
  titular: string | null;
  formulacao: string | null;
  modo_acao: string | null;
  tecnica_aplicacao: string | null;
  toxicologica: string | null;
  ambiental: string | null;
  organico: boolean;
  url_agrofit: string | null;
  n_culturas: number;
  alvos: string | null;
  via_todas_as_culturas: boolean;
};

type Inoculante = {
  registro_produto: string | null;
  razao_social: string | null;
  uf: string | null;
  atividade: string | null;
  tipo: string | null;
  especie: string | null;
  cultura: string | null;
  cultura_nome_cientifico: string | null;
  garantia: string | null;
  natureza_fisica: string | null;
  data_registro: string | null;
};

type Resultado = {
  aba: "produtos" | "inoculantes";
  total: number;
  pagina: number;
  paginas: number;
  atualizadoEm: string | null;
  /** Tabela vazia: a coleta nunca rodou. Diferente de "não há registro". */
  baseVazia?: boolean;
  temAlvos?: boolean;
  viaTodasAsCulturas?: number;
  itens: Produto[] | Inoculante[];
};

type Vocabulario = {
  culturas: string[];
  pragas: string[];
  ingredientes: string[];
  titulares: string[];
  classes: string[];
  especies: string[];
  ufs: string[];
  tipos: string[];
};

type Aba = "produtos" | "inoculantes";

type Filtros = {
  q: string;
  cultura: string;
  praga: string;
  ingrediente: string;
  titular: string;
  classe: string;
  organico: boolean;
  especie: string;
  uf: string;
  tipo: string;
};

const VAZIO: Filtros = {
  q: "",
  cultura: "",
  praga: "",
  ingrediente: "",
  titular: "",
  classe: "",
  organico: false,
  especie: "",
  uf: "",
  tipo: "",
};

const EXEMPLOS: Record<Aba, { rotulo: string; filtros: Partial<Filtros> }[]> = {
  produtos: [
    { rotulo: "Serve para pitaya", filtros: { cultura: "Pitaya" } },
    { rotulo: "Mosca-branca", filtros: { praga: "Mosca-branca" } },
    { rotulo: "Com Bacillus", filtros: { ingrediente: "Bacillus" } },
    { rotulo: "Fungicidas microbiológicos", filtros: { classe: "Fungicida Microbiológico" } },
    { rotulo: "Aprovados para orgânico", filtros: { organico: true } },
  ],
  inoculantes: [
    { rotulo: "Para soja", filtros: { cultura: "Soja" } },
    { rotulo: "Bradyrhizobium", filtros: { especie: "Bradyrhizobium" } },
    { rotulo: "Registrados em SP", filtros: { uf: "SP" } },
  ],
};

type CulturaDoProduto = { cultura: string; alvos: string | null };

export default function BuscaBioinsumos() {
  const [aba, setAba] = useState<Aba>("produtos");
  const [filtros, setFiltros] = useState<Filtros>(VAZIO);
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<Resultado | null>(null);
  const [vocab, setVocab] = useState<Vocabulario | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [culturas, setCulturas] = useState<Record<string, CulturaDoProduto[]>>({});

  async function alternarCulturas(registro: string | null) {
    if (!registro) return;
    if (aberto === registro) {
      setAberto(null);
      return;
    }
    setAberto(registro);
    if (culturas[registro]) return;
    try {
      const res = await fetch(`/api/bioinsumos/culturas?registro=${encodeURIComponent(registro)}`);
      const json = await res.json();
      if (res.ok) setCulturas((c) => ({ ...c, [registro]: json.culturas }));
    } catch {
      // Falha aqui não pode derrubar a listagem: a linha só não expande.
    }
  }

  useEffect(() => {
    fetch("/api/bioinsumos/vocabulario")
      .then((r) => (r.ok ? r.json() : null))
      .then(setVocab)
      .catch(() => setVocab(null));
  }, []);

  const buscar = useCallback(async (a: Aba, f: Filtros, pg: number) => {
    setCarregando(true);
    setErro(null);
    try {
      const p = new URLSearchParams({ aba: a });
      if (f.q) p.set("q", f.q);
      if (f.cultura) p.set("cultura", f.cultura);
      if (a === "produtos") {
        if (f.praga) p.set("praga", f.praga);
        if (f.ingrediente) p.set("ingrediente", f.ingrediente);
        if (f.titular) p.set("titular", f.titular);
        if (f.classe) p.set("classe", f.classe);
        if (f.organico) p.set("organico", "1");
      } else {
        if (f.especie) p.set("especie", f.especie);
        if (f.uf) p.set("uf", f.uf);
        if (f.tipo) p.set("tipo", f.tipo);
      }
      p.set("pagina", String(pg));

      const res = await fetch(`/api/bioinsumos?${p}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha na consulta");
      setDados(json);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setDados(null);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    buscar(aba, filtros, pagina);
    // Refaz a busca quando a aba, os filtros ou a página mudam.
  }, [aba, filtros, pagina, buscar]);

  function mudar(campo: keyof Filtros, valor: string | boolean) {
    setPagina(1);
    setFiltros((f) => ({ ...f, [campo]: valor }));
  }

  function aplicarExemplo(parcial: Partial<Filtros>) {
    setPagina(1);
    setFiltros({ ...VAZIO, ...parcial });
  }

  function trocarAba(nova: Aba) {
    if (nova === aba) return;
    setAba(nova);
    setPagina(1);
    setAberto(null);
    // A cultura sobrevive à troca: é o único filtro comum às duas abas, e
    // perdê-la faria o usuário redigitar para ver o outro lado do mesmo tema.
    setFiltros({ ...VAZIO, cultura: filtros.cultura });
  }

  const temFiltro = Object.entries(filtros).some(([, v]) => v !== "" && v !== false);
  const produtos = dados?.aba === "produtos" ? (dados.itens as Produto[]) : [];
  const inoculantes = dados?.aba === "inoculantes" ? (dados.itens as Inoculante[]) : [];
  const colunas = dados?.temAlvos ? 8 : 7;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Bioinsumos</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--suave)" }}>
          Produtos biológicos e inoculantes registrados no MAPA. Consulta direta
          à cópia local da API Bioinsumos — sem IA, sem inferência: o que aparece
          aqui é o que está na base.{" "}
          <a href="/agrofit" className="underline" style={{ color: "var(--acento)" }}>
            Base Agrofit
          </a>{" "}
          ·{" "}
          <a href="/" className="underline" style={{ color: "var(--acento)" }}>
            chat da pitaya
          </a>
        </p>
      </header>

      <div className="mb-4 flex gap-1 border-b" style={{ borderColor: "var(--borda)" }}>
        <Guia rotulo="Controle de pragas" ativa={aba === "produtos"} aoClicar={() => trocarAba("produtos")} />
        <Guia rotulo="Inoculantes" ativa={aba === "inoculantes"} aoClicar={() => trocarAba("inoculantes")} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {EXEMPLOS[aba].map((e) => (
          <button
            key={e.rotulo}
            onClick={() => aplicarExemplo(e.filtros)}
            className="rounded-full border px-3 py-1 text-xs transition"
            style={{ borderColor: "var(--borda)", color: "var(--suave)" }}
          >
            {e.rotulo}
          </button>
        ))}
        {temFiltro && (
          <button
            onClick={() => aplicarExemplo({})}
            className="rounded-full px-3 py-1 text-xs underline"
            style={{ color: "var(--acento)" }}
          >
            limpar
          </button>
        )}
      </div>

      <section
        className="mb-6 grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-3"
        style={{ borderColor: "var(--borda)", background: "var(--painel)" }}
      >
        {aba === "produtos" ? (
          <>
            <Campo
              rotulo="Produto ou nº de registro"
              valor={filtros.q}
              aoMudar={(v) => mudar("q", v)}
              dica="Ex.: Dipel, 24618"
            />
            <Campo
              rotulo="Cultura"
              valor={filtros.cultura}
              aoMudar={(v) => mudar("cultura", v)}
              lista={vocab?.culturas}
              listaId="bio-culturas"
              dica="Inclui os de uso geral"
            />
            <Campo
              rotulo="Praga ou doença"
              valor={filtros.praga}
              aoMudar={(v) => mudar("praga", v)}
              lista={vocab?.pragas}
              listaId="bio-pragas"
              dica="Nome comum ou científico"
            />
            <Campo
              rotulo="Ingrediente ativo"
              valor={filtros.ingrediente}
              aoMudar={(v) => mudar("ingrediente", v)}
              lista={vocab?.ingredientes}
              listaId="bio-ingredientes"
              dica="Ex.: Bacillus, Trichoderma"
            />
            <Campo
              rotulo="Titular do registro"
              valor={filtros.titular}
              aoMudar={(v) => mudar("titular", v)}
              lista={vocab?.titulares}
              listaId="bio-titulares"
            />
            <Campo
              rotulo="Classe agronômica"
              valor={filtros.classe}
              aoMudar={(v) => mudar("classe", v)}
              lista={vocab?.classes}
              listaId="bio-classes"
              dica="Ex.: Inseticida Microbiológico"
            />
            <div className="flex items-end gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filtros.organico}
                  onChange={(e) => mudar("organico", e.target.checked)}
                />
                Uso orgânico
              </label>
            </div>
          </>
        ) : (
          <>
            <Campo
              rotulo="Registro ou empresa"
              valor={filtros.q}
              aoMudar={(v) => mudar("q", v)}
              dica="Ex.: PR0023604-19, Forbio"
            />
            <Campo
              rotulo="Cultura"
              valor={filtros.cultura}
              aoMudar={(v) => mudar("cultura", v)}
              lista={vocab?.culturas}
              listaId="bio-culturas"
              dica="Ex.: Soja, Feijão"
            />
            <Campo
              rotulo="Espécie"
              valor={filtros.especie}
              aoMudar={(v) => mudar("especie", v)}
              lista={vocab?.especies}
              listaId="bio-especies"
              dica="Ex.: Bradyrhizobium"
            />
            <Campo
              rotulo="Tipo"
              valor={filtros.tipo}
              aoMudar={(v) => mudar("tipo", v)}
              lista={vocab?.tipos}
              listaId="bio-tipos"
              dica="Ex.: fixadora de nitrogênio"
            />
            <Campo
              rotulo="UF"
              valor={filtros.uf}
              aoMudar={(v) => mudar("uf", v)}
              lista={vocab?.ufs}
              listaId="bio-ufs"
              dica="Sigla do estado do registro"
            />
          </>
        )}
      </section>

      <div className="mb-3 text-sm" style={{ color: "var(--suave)" }}>
        {carregando
          ? "Consultando…"
          : erro
            ? ""
            : dados
              ? `${dados.total.toLocaleString("pt-BR")} ${
                  dados.aba === "produtos" ? "produto(s)" : "registro(s)"
                }` +
                (dados.paginas > 1 ? ` — página ${dados.pagina} de ${dados.paginas}` : "") +
                (dados.atualizadoEm ? ` · cadastro de ${dados.atualizadoEm}` : "")
              : ""}
      </div>

      {erro && (
        <p className="rounded-lg border p-4 text-sm" style={{ borderColor: "var(--acento)" }}>
          {erro}
        </p>
      )}

      {/* O aviso do "Todas as culturas" é o ponto sutil desta base: sem ele o
          usuário acha que o produto foi registrado nominalmente para a cultura
          dele, quando o registro é genérico. */}
      {dados?.aba === "produtos" &&
        filtros.cultura &&
        (dados.viaTodasAsCulturas ?? 0) > 0 &&
        !carregando && (
          <p
            className="mb-3 rounded-lg border p-3 text-xs"
            style={{ borderColor: "var(--borda)", background: "var(--acento-suave)" }}
          >
            {dados.viaTodasAsCulturas} dos {dados.total} casaram por{" "}
            <strong>&ldquo;Todas as culturas&rdquo;</strong> — registro geral, que
            vale para {filtros.cultura} sem citá-la. As linhas assim vêm marcadas.
          </p>
        )}

      {/* Base não coletada e registro inexistente são coisas diferentes, e
          tratar as duas como "nenhum resultado" faria o usuário concluir que
          não há bioinsumo para a cultura dele. */}
      {dados?.baseVazia && !carregando && (
        <div
          className="rounded-lg border p-4 text-sm"
          style={{ borderColor: "var(--acento)", background: "var(--painel)" }}
        >
          <p className="font-medium">A base local ainda não foi coletada.</p>
          <p className="mt-1" style={{ color: "var(--suave)" }}>
            Esta página lê a cópia no Postgres, não a API da Embrapa. Rode{" "}
            <code>npm run bioinsumos:sync</code> uma vez (leva ~40s) e recarregue.
          </p>
        </div>
      )}

      {dados && dados.total === 0 && !dados.baseVazia && !carregando && (
        <div
          className="rounded-lg border p-4 text-sm"
          style={{ borderColor: "var(--borda)", background: "var(--painel)" }}
        >
          <p className="font-medium">Nenhum registro para esses filtros.</p>
          <p className="mt-1" style={{ color: "var(--suave)" }}>
            A base de bioinsumos é pequena — 834 produtos biológicos e 1.032
            inoculantes —, então isso costuma significar que o registro não existe
            mesmo. Confira a grafia da cultura: a busca compara com o nome do MAPA
            (&ldquo;Pitaya&rdquo;, não &ldquo;pitaia&rdquo;).
          </p>
        </div>
      )}

      {dados?.aba === "produtos" && produtos.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr style={{ color: "var(--suave)" }}>
                <Th>Produto</Th>
                <Th>Ingrediente ativo</Th>
                <Th>Classe</Th>
                {dados.temAlvos && <Th>Alvos</Th>}
                <Th>Registro</Th>
                <Th>Titular</Th>
                <Th>Toxicológica</Th>
                <Th>Ambiental</Th>
              </tr>
            </thead>
            <tbody>
              {produtos.map((it) => (
                <Fragment key={it.numero_registro ?? it.nome}>
                  <tr className="align-top" style={{ borderTop: "1px solid var(--borda)" }}>
                    <td className="py-2 pr-3">
                      <span className="font-medium">{it.nome}</span>
                      {it.via_todas_as_culturas && (
                        <span
                          className="ml-2 rounded-full px-2 py-0.5 text-[10px]"
                          style={{ background: "var(--acento-suave)", color: "var(--acento)" }}
                        >
                          todas as culturas
                        </span>
                      )}
                      <span className="block text-xs" style={{ color: "var(--suave)" }}>
                        {it.formulacao ?? "—"}
                        {it.organico ? " · uso orgânico" : ""}
                        {" · "}
                        <button
                          onClick={() => alternarCulturas(it.numero_registro)}
                          className="underline"
                          style={{ color: "var(--acento)" }}
                        >
                          {it.n_culturas} cultura(s)
                          {aberto === it.numero_registro ? " ▲" : " ▼"}
                        </button>
                      </span>
                    </td>
                    <td className="py-2 pr-3">{it.ingrediente_ativo ?? "—"}</td>
                    <td className="py-2 pr-3">{it.classe ?? "—"}</td>
                    {dados.temAlvos && <td className="py-2 pr-3">{it.alvos ?? "—"}</td>}
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {it.url_agrofit ? (
                        <a
                          href={it.url_agrofit}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                          style={{ color: "var(--acento)" }}
                        >
                          {it.numero_registro}
                        </a>
                      ) : (
                        (it.numero_registro ?? "—")
                      )}
                    </td>
                    <td className="py-2 pr-3">{it.titular ?? "—"}</td>
                    <td className="py-2 pr-3">{it.toxicologica ?? "—"}</td>
                    <td className="py-2">{it.ambiental ?? "—"}</td>
                  </tr>
                  {aberto === it.numero_registro && (
                    <tr>
                      <td colSpan={colunas} className="pb-4">
                        <div
                          className="rounded-lg border p-3 text-xs"
                          style={{ borderColor: "var(--borda)", background: "var(--painel)" }}
                        >
                          {!culturas[it.numero_registro!] ? (
                            <span style={{ color: "var(--suave)" }}>Carregando culturas…</span>
                          ) : (
                            <>
                              <p className="mb-2" style={{ color: "var(--suave)" }}>
                                Culturas com registro para este produto, e os alvos em cada uma:
                              </p>
                              <ul className="grid gap-1 sm:grid-cols-2">
                                {culturas[it.numero_registro!].map((c) => (
                                  <li key={c.cultura}>
                                    <strong>{c.cultura}</strong>
                                    <span style={{ color: "var(--suave)" }}>
                                      {c.alvos ? ` — ${c.alvos}` : " — sem alvo específico"}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                              {it.modo_acao && (
                                <p className="mt-2" style={{ color: "var(--suave)" }}>
                                  Modo de ação: {it.modo_acao}
                                  {it.tecnica_aplicacao ? ` · aplicação: ${it.tecnica_aplicacao}` : ""}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dados?.aba === "inoculantes" && inoculantes.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr style={{ color: "var(--suave)" }}>
                <Th>Registro</Th>
                <Th>Empresa</Th>
                <Th>Espécie</Th>
                <Th>Tipo</Th>
                <Th>Cultura</Th>
                <Th>Garantia</Th>
                <Th>Natureza</Th>
              </tr>
            </thead>
            <tbody>
              {inoculantes.map((it, i) => (
                <tr
                  key={`${it.registro_produto}-${it.cultura}-${i}`}
                  className="align-top"
                  style={{ borderTop: "1px solid var(--borda)" }}
                >
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <span className="font-medium">{it.registro_produto ?? "—"}</span>
                    <span className="block text-xs" style={{ color: "var(--suave)" }}>
                      {it.uf ?? "—"} · {it.atividade?.toLowerCase() ?? "—"}
                    </span>
                  </td>
                  <td className="py-2 pr-3">{it.razao_social ?? "—"}</td>
                  <td className="py-2 pr-3 italic">{it.especie ?? "—"}</td>
                  <td className="py-2 pr-3">{it.tipo ?? "—"}</td>
                  <td className="py-2 pr-3">
                    {it.cultura ?? "—"}
                    {it.cultura_nome_cientifico && (
                      <span className="block text-xs italic" style={{ color: "var(--suave)" }}>
                        {it.cultura_nome_cientifico}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3">{it.garantia ?? "—"}</td>
                  <td className="py-2">{it.natureza_fisica ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dados && dados.paginas > 1 && (
        <div className="mt-4 flex items-center gap-3 text-sm">
          <Paginar
            rotulo="Anterior"
            ativo={dados.pagina > 1}
            aoClicar={() => setPagina((p) => p - 1)}
          />
          <Paginar
            rotulo="Próxima"
            ativo={dados.pagina < dados.paginas}
            aoClicar={() => setPagina((p) => p + 1)}
          />
        </div>
      )}

      <footer className="mt-8 text-xs" style={{ color: "var(--suave)" }}>
        Esta lista indica apenas o <strong>registro no MAPA</strong>. Bioinsumo
        registrado continua sendo defensivo: dose, intervalo de segurança e modo
        de aplicação constam da bula, e a aquisição e a aplicação exigem
        receituário agronômico emitido por profissional habilitado. Inoculante é
        registrado por empresa e cultura — o mesmo produto aparece uma vez para
        cada cultura em que foi registrado.
      </footer>
    </main>
  );
}

function Guia(props: { rotulo: string; ativa: boolean; aoClicar: () => void }) {
  return (
    <button
      onClick={props.aoClicar}
      className="-mb-px border-b-2 px-4 py-2 text-sm transition"
      style={{
        borderColor: props.ativa ? "var(--acento)" : "transparent",
        color: props.ativa ? "var(--acento)" : "var(--suave)",
        fontWeight: props.ativa ? 500 : 400,
      }}
    >
      {props.rotulo}
    </button>
  );
}

function Campo(props: {
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  lista?: string[];
  listaId?: string;
  dica?: string;
}) {
  return (
    <label className="block text-sm">
      <span style={{ color: "var(--suave)" }}>{props.rotulo}</span>
      <input
        value={props.valor}
        onChange={(e) => props.aoMudar(e.target.value)}
        list={props.lista ? props.listaId : undefined}
        placeholder={props.dica}
        className="mt-1 w-full rounded-lg border px-3 py-2 outline-none"
        style={{
          borderColor: "var(--borda)",
          background: "var(--fundo)",
          color: "var(--texto)",
        }}
      />
      {props.lista && (
        <datalist id={props.listaId}>
          {props.lista.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
      )}
    </label>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="pb-2 pr-3 text-left font-normal" style={{ color: "var(--suave)" }}>
      {children}
    </th>
  );
}

function Paginar(props: { rotulo: string; ativo: boolean; aoClicar: () => void }) {
  return (
    <button
      onClick={props.aoClicar}
      disabled={!props.ativo}
      className="rounded-lg border px-3 py-1 disabled:opacity-40"
      style={{ borderColor: "var(--borda)" }}
    >
      {props.rotulo}
    </button>
  );
}
