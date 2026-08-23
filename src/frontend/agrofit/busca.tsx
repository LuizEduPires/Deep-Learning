"use client";

import { Fragment, useCallback, useEffect, useState } from "react";

type Item = {
  registration: string | null;
  product_name: string;
  active_ingredient: string | null;
  product_class: string | null;
  holder: string | null;
  formulacao: string | null;
  modo_acao: string | null;
  toxicological_class: string | null;
  environmental_class: string | null;
  produto_biologico: boolean | null;
  agricultura_organica: boolean | null;
  url_agrofit: string | null;
  n_culturas: string;
  alvos: string | null;
};

type Resultado = {
  total: number;
  pagina: number;
  paginas: number;
  temAlvos: boolean;
  itens: Item[];
};

type Vocabulario = {
  culturas: string[];
  classes: string[];
  ingredientes: string[];
  titulares: string[];
  pragas: string[];
};

type Filtros = {
  q: string;
  cultura: string;
  praga: string;
  ingrediente: string;
  titular: string;
  classe: string;
  bio: boolean;
  organico: boolean;
};

const VAZIO: Filtros = {
  q: "",
  cultura: "",
  praga: "",
  ingrediente: "",
  titular: "",
  classe: "",
  bio: false,
  organico: false,
};

const EXEMPLOS: { rotulo: string; filtros: Partial<Filtros> }[] = [
  { rotulo: "Tudo que é registrado para pitaya", filtros: { cultura: "Pitaya" } },
  { rotulo: "Antracnose em pitaya", filtros: { cultura: "Pitaya", praga: "Antracnose" } },
  { rotulo: "Produtos biológicos", filtros: { bio: true } },
  { rotulo: "Aprovados para agricultura orgânica", filtros: { organico: true } },
  { rotulo: "Com difenoconazol", filtros: { ingrediente: "Difenoconazol" } },
];

type CulturaDoProduto = { cultura: string; alvos: string | null };

export default function BuscaAgrofit() {
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
      const res = await fetch(`/api/agrofit/culturas?registro=${encodeURIComponent(registro)}`);
      const json = await res.json();
      if (res.ok) setCulturas((c) => ({ ...c, [registro]: json.culturas }));
    } catch {
      // Falha aqui não pode derrubar a listagem: a linha só não expande.
    }
  }

  useEffect(() => {
    fetch("/api/agrofit/vocabulario")
      .then((r) => (r.ok ? r.json() : null))
      .then(setVocab)
      .catch(() => setVocab(null));
  }, []);

  const buscar = useCallback(async (f: Filtros, pg: number) => {
    setCarregando(true);
    setErro(null);
    try {
      const p = new URLSearchParams();
      if (f.q) p.set("q", f.q);
      if (f.cultura) p.set("cultura", f.cultura);
      if (f.praga) p.set("praga", f.praga);
      if (f.ingrediente) p.set("ingrediente", f.ingrediente);
      if (f.titular) p.set("titular", f.titular);
      if (f.classe) p.set("classe", f.classe);
      if (f.bio) p.set("bio", "1");
      if (f.organico) p.set("organico", "1");
      p.set("pagina", String(pg));

      const res = await fetch(`/api/agrofit?${p}`);
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
    buscar(filtros, pagina);
    // Refaz a busca quando os filtros ou a página mudam. `buscar` é estável.
  }, [filtros, pagina, buscar]);

  function mudar(campo: keyof Filtros, valor: string | boolean) {
    setPagina(1);
    setFiltros((f) => ({ ...f, [campo]: valor }));
  }

  function aplicarExemplo(parcial: Partial<Filtros>) {
    setPagina(1);
    setFiltros({ ...VAZIO, ...parcial });
  }

  const temFiltro = Object.entries(filtros).some(([, v]) => v !== "" && v !== false);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Base Agrofit</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--suave)" }}>
          Produtos fitossanitários registrados no MAPA. Consulta direta à cópia
          local da API Agrofit — sem IA, sem inferência: o que aparece aqui é o
          que está na base.{" "}
          <a href="/bioinsumos" className="underline" style={{ color: "var(--acento)" }}>
            Bioinsumos
          </a>{" "}
          ·{" "}
          <a href="/" className="underline" style={{ color: "var(--acento)" }}>
            chat da pitaya
          </a>
        </p>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {EXEMPLOS.map((e) => (
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
        <Campo
          rotulo="Produto ou nº de registro"
          valor={filtros.q}
          aoMudar={(v) => mudar("q", v)}
          dica="Ex.: Graduate, 10520"
        />
        <Campo
          rotulo="Cultura"
          valor={filtros.cultura}
          aoMudar={(v) => mudar("cultura", v)}
          lista={vocab?.culturas}
          listaId="culturas"
          dica="Escolha da lista — a grafia precisa bater"
        />
        <Campo
          rotulo="Praga ou doença"
          valor={filtros.praga}
          aoMudar={(v) => mudar("praga", v)}
          lista={vocab?.pragas}
          listaId="pragas"
          dica="Nome comum ou científico"
        />
        <Campo
          rotulo="Ingrediente ativo"
          valor={filtros.ingrediente}
          aoMudar={(v) => mudar("ingrediente", v)}
          lista={vocab?.ingredientes}
          listaId="ingredientes"
        />
        <Campo
          rotulo="Titular do registro"
          valor={filtros.titular}
          aoMudar={(v) => mudar("titular", v)}
          lista={vocab?.titulares}
          listaId="titulares"
        />
        <Campo
          rotulo="Classe agronômica"
          valor={filtros.classe}
          aoMudar={(v) => mudar("classe", v)}
          lista={vocab?.classes}
          listaId="classes"
          dica="Ex.: Fungicida, Inseticida"
        />
        <div className="flex items-end gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filtros.bio}
              onChange={(e) => mudar("bio", e.target.checked)}
            />
            Biológico
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filtros.organico}
              onChange={(e) => mudar("organico", e.target.checked)}
            />
            Uso orgânico
          </label>
        </div>
      </section>

      <div className="mb-3 text-sm" style={{ color: "var(--suave)" }}>
        {carregando
          ? "Consultando…"
          : erro
            ? ""
            : dados
              ? `${dados.total.toLocaleString("pt-BR")} produto(s)` +
                (dados.paginas > 1 ? ` — página ${dados.pagina} de ${dados.paginas}` : "")
              : ""}
      </div>

      {erro && (
        <p className="rounded-lg border p-4 text-sm" style={{ borderColor: "var(--acento)" }}>
          {erro}
        </p>
      )}

      {dados && dados.total === 0 && !carregando && (
        <div
          className="rounded-lg border p-4 text-sm"
          style={{ borderColor: "var(--borda)", background: "var(--painel)" }}
        >
          <p className="font-medium">Nenhum produto para esses filtros.</p>
          <p className="mt-1" style={{ color: "var(--suave)" }}>
            A base está completa, então isso normalmente significa que o registro
            não existe mesmo. Só confirme que a cultura foi escolhida da lista —
            a busca compara com a grafia exata do MAPA (&ldquo;Pitaya&rdquo;, não
            &ldquo;pitaia&rdquo;).
          </p>
        </div>
      )}

      {dados && dados.itens.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr style={{ color: "var(--suave)" }}>
                <Th>Produto</Th>
                <Th>Ingrediente ativo</Th>
                <Th>Classe</Th>
                {dados.temAlvos && <Th>Alvos nesta cultura</Th>}
                <Th>Registro</Th>
                <Th>Titular</Th>
                <Th>Toxicológica</Th>
                <Th>Ambiental</Th>
              </tr>
            </thead>
            <tbody>
              {dados.itens.map((it) => (
                <Fragment key={it.registration ?? it.product_name}>
                <tr className="align-top" style={{ borderTop: "1px solid var(--borda)" }}>
                  <td className="py-2 pr-3">
                    <span className="font-medium">{it.product_name}</span>
                    <span className="block text-xs" style={{ color: "var(--suave)" }}>
                      {it.formulacao ?? "—"}
                      {it.produto_biologico ? " · biológico" : ""}
                      {it.agricultura_organica ? " · uso orgânico" : ""}
                      {" · "}
                      <button
                        onClick={() => alternarCulturas(it.registration)}
                        className="underline"
                        style={{ color: "var(--acento)" }}
                      >
                        {it.n_culturas} cultura(s)
                        {aberto === it.registration ? " ▲" : " ▼"}
                      </button>
                    </span>
                  </td>
                  <td className="py-2 pr-3">{it.active_ingredient ?? "—"}</td>
                  <td className="py-2 pr-3">{it.product_class ?? "—"}</td>
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
                        {it.registration}
                      </a>
                    ) : (
                      (it.registration ?? "—")
                    )}
                  </td>
                  <td className="py-2 pr-3">{it.holder ?? "—"}</td>
                  <td className="py-2 pr-3">{it.toxicological_class ?? "—"}</td>
                  <td className="py-2">{it.environmental_class ?? "—"}</td>
                </tr>
                {aberto === it.registration && (
                  <tr>
                    <td colSpan={dados.temAlvos ? 8 : 7} className="pb-4">
                      <div
                        className="rounded-lg border p-3 text-xs"
                        style={{ borderColor: "var(--borda)", background: "var(--painel)" }}
                      >
                        {!culturas[it.registration!] ? (
                          <span style={{ color: "var(--suave)" }}>Carregando culturas…</span>
                        ) : (
                          <>
                            <p className="mb-2" style={{ color: "var(--suave)" }}>
                              Culturas com registro para este produto, e os alvos em cada uma:
                            </p>
                            <ul className="grid gap-1 sm:grid-cols-2">
                              {culturas[it.registration!].map((c) => (
                                <li key={c.cultura}>
                                  <strong>{c.cultura}</strong>
                                  <span style={{ color: "var(--suave)" }}>
                                    {c.alvos ? ` — ${c.alvos}` : " — sem alvo específico"}
                                  </span>
                                </li>
                              ))}
                            </ul>
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
        Esta lista indica apenas o <strong>registro no MAPA</strong>. Dose,
        intervalo de segurança e modo de aplicação constam da bula; a aquisição e
        a aplicação exigem receituário agronômico emitido por profissional
        habilitado.
      </footer>
    </main>
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
