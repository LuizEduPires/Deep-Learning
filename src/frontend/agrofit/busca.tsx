"use client";

import { useCallback, useEffect, useState } from "react";
import { Campo, Chip } from "../ui";
import {
  AvisoReceituario,
  Caixinha,
  CabecalhoProdutos,
  Carregando,
  CartaoProduto,
  Contagem,
  Erro,
  PainelFiltros,
  Paginacao,
  Vazio,
  usarCulturas,
} from "../produtos/comum";

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
  { rotulo: "Tudo para pitaya", filtros: { cultura: "Pitaya" } },
  { rotulo: "Antracnose em pitaya", filtros: { cultura: "Pitaya", praga: "Antracnose" } },
  { rotulo: "Biológicos", filtros: { bio: true } },
  { rotulo: "Uso orgânico", filtros: { organico: true } },
  { rotulo: "Com difenoconazol", filtros: { ingrediente: "Difenoconazol" } },
];

function igual(a: Filtros, b: Partial<Filtros>) {
  return JSON.stringify(a) === JSON.stringify({ ...VAZIO, ...b });
}

export default function BuscaAgrofit() {
  const [filtros, setFiltros] = useState<Filtros>(VAZIO);
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<Resultado | null>(null);
  const [vocab, setVocab] = useState<Vocabulario | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const culturas = usarCulturas("/api/agrofit/culturas");

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
  const extrasAtivos = [filtros.q, filtros.ingrediente, filtros.titular, filtros.classe, filtros.bio, filtros.organico].filter(
    (v) => v !== "" && v !== false,
  ).length;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 px-5 pt-6 pb-8 md:px-8 md:pt-8">
      <CabecalhoProdutos base="agrofit" />

      <PainelFiltros
        extrasAtivos={extrasAtivos}
        principais={
          <>
            <Campo
              rotulo="Praga ou doença"
              valor={filtros.praga}
              aoMudar={(v) => mudar("praga", v)}
              lista={vocab?.pragas}
              listaId="pragas"
              dica="Nome comum ou científico"
              icone="busca"
            />
            <Campo
              rotulo="Cultura"
              valor={filtros.cultura}
              aoMudar={(v) => mudar("cultura", v)}
              lista={vocab?.culturas}
              listaId="culturas"
              dica="Escolha da lista — ex.: Pitaya"
              icone="broto"
            />
          </>
        }
        extras={
          <>
            <Campo rotulo="Produto ou nº de registro" valor={filtros.q} aoMudar={(v) => mudar("q", v)} dica="Ex.: Graduate, 10520" />
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
            <div className="flex flex-wrap items-end gap-x-5">
              <Caixinha rotulo="Biológico" marcado={filtros.bio} aoMudar={(v) => mudar("bio", v)} />
              <Caixinha rotulo="Uso orgânico" marcado={filtros.organico} aoMudar={(v) => mudar("organico", v)} />
            </div>
          </>
        }
      />

      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {EXEMPLOS.map((e) => (
          <Chip key={e.rotulo} ativo={igual(filtros, e.filtros)} aoClicar={() => aplicarExemplo(e.filtros)}>
            {e.rotulo}
          </Chip>
        ))}
        {temFiltro && (
          <button
            type="button"
            onClick={() => aplicarExemplo({})}
            className="min-h-10 shrink-0 px-2 text-sm font-bold text-acento-texto"
          >
            Limpar
          </button>
        )}
      </div>

      <AvisoReceituario />

      <Contagem
        texto={
          carregando
            ? "Consultando…"
            : dados && !erro
              ? `${dados.total.toLocaleString("pt-BR")} produto(s)`
              : ""
        }
      />

      {erro && <Erro texto={erro} />}

      {carregando && !dados && <Carregando />}

      {dados && dados.total === 0 && !carregando && (
        <Vazio titulo="Nenhum produto para esses filtros.">
          A base está completa, então isso normalmente significa que o registro não existe mesmo. Só
          confirme que a cultura foi escolhida da lista — a busca compara com a grafia exata do MAPA
          (&ldquo;Pitaya&rdquo;, não &ldquo;pitaia&rdquo;).
        </Vazio>
      )}

      {dados && dados.itens.length > 0 && (
        <div className={`grid gap-3 md:grid-cols-2 xl:grid-cols-3 ${carregando ? "opacity-60" : ""}`}>
          {dados.itens.map((it) => (
            <CartaoProduto
              key={it.registration ?? it.product_name}
              aberto={culturas.aberto === it.registration}
              culturas={it.registration ? culturas.culturas[it.registration] : undefined}
              aoAlternar={() => culturas.alternar(it.registration)}
              p={{
                chave: it.registration ?? it.product_name,
                nome: it.product_name,
                ingrediente: it.active_ingredient,
                classe: it.product_class,
                biologico: it.produto_biologico,
                organico: it.agricultura_organica,
                registro: it.registration,
                url: it.url_agrofit,
                titular: it.holder,
                toxicologica: it.toxicological_class,
                ambiental: it.environmental_class,
                formulacao: it.formulacao,
                alvos: dados.temAlvos ? it.alvos : null,
                nCulturas: it.n_culturas,
                modoAcao: it.modo_acao,
              }}
            />
          ))}
        </div>
      )}

      {dados && <Paginacao pagina={dados.pagina} paginas={dados.paginas} aoMudar={setPagina} />}
    </main>
  );
}
