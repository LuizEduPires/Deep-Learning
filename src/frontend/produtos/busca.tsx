"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Campo, Chip, Etiqueta, classeCartao } from "../ui";
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
} from "./comum";

/**
 * Tela única de produtos registrados no MAPA.
 *
 * Antes eram duas bases lado a lado, Agrofit e Bioinsumos, mas os 834
 * biológicos do Bioinsumos são os mesmos do Agrofit (mesmo registro, já
 * marcados como biológicos). A lista principal vem toda do Agrofit, com
 * "Biológicos" como atalho. Só os inoculantes existem apenas no Bioinsumos e
 * têm outro formato (espécie, UF, garantia), por isso ficam num modo próprio.
 *
 * Aceita ?bio=1 (abre filtrando biológicos) e ?tipo=inoculantes.
 */

type Produto = {
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

type ResultadoProdutos = {
  total: number;
  pagina: number;
  paginas: number;
  temAlvos: boolean;
  viaTodasAsCulturas: number;
  itens: Produto[];
};

type ResultadoInoculantes = {
  total: number;
  pagina: number;
  paginas: number;
  atualizadoEm: string | null;
  /** Tabela vazia: a coleta nunca rodou. Diferente de "não há registro". */
  baseVazia?: boolean;
  itens: Inoculante[];
};

type VocabProdutos = {
  culturas: string[];
  classes: string[];
  ingredientes: string[];
  titulares: string[];
  pragas: string[];
};

type VocabInoculantes = {
  culturas: string[];
  especies: string[];
  ufs: string[];
  tipos: string[];
};

type Modo = "produtos" | "inoculantes";

type Filtros = {
  q: string;
  cultura: string;
  praga: string;
  ingrediente: string;
  titular: string;
  classe: string;
  bio: boolean;
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
  bio: false,
  organico: false,
  especie: "",
  uf: "",
  tipo: "",
};

const EXEMPLOS: { rotulo: string; filtros: Partial<Filtros> }[] = [
  { rotulo: "Tudo para pitaya", filtros: { cultura: "Pitaya" } },
  { rotulo: "Antracnose em pitaya", filtros: { cultura: "Pitaya", praga: "Antracnose" } },
  { rotulo: "Biológicos", filtros: { bio: true } },
  { rotulo: "Biológicos para pitaya", filtros: { cultura: "Pitaya", bio: true } },
  { rotulo: "Uso orgânico", filtros: { organico: true } },
  { rotulo: "Com Bacillus", filtros: { ingrediente: "Bacillus" } },
];

function igual(a: Filtros, b: Partial<Filtros>) {
  return JSON.stringify(a) === JSON.stringify({ ...VAZIO, ...b });
}

function parametros(modo: Modo, f: Filtros, pg: number) {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.cultura) p.set("cultura", f.cultura);
  if (modo === "produtos") {
    if (f.praga) p.set("praga", f.praga);
    if (f.ingrediente) p.set("ingrediente", f.ingrediente);
    if (f.titular) p.set("titular", f.titular);
    if (f.classe) p.set("classe", f.classe);
    if (f.bio) p.set("bio", "1");
    if (f.organico) p.set("organico", "1");
  } else {
    p.set("aba", "inoculantes");
    if (f.especie) p.set("especie", f.especie);
    if (f.uf) p.set("uf", f.uf);
    if (f.tipo) p.set("tipo", f.tipo);
  }
  p.set("pagina", String(pg));
  return p;
}

export default function BuscaProdutos() {
  const params = useSearchParams();
  const [modo, setModo] = useState<Modo>(params.get("tipo") === "inoculantes" ? "inoculantes" : "produtos");
  const [filtros, setFiltros] = useState<Filtros>({ ...VAZIO, bio: params.get("bio") === "1" });
  const [pagina, setPagina] = useState(1);
  const [produtos, setProdutos] = useState<ResultadoProdutos | null>(null);
  const [inoculantes, setInoculantes] = useState<ResultadoInoculantes | null>(null);
  const [vocabProd, setVocabProd] = useState<VocabProdutos | null>(null);
  const [vocabInoc, setVocabInoc] = useState<VocabInoculantes | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const culturas = usarCulturas("/api/agrofit/culturas");

  useEffect(() => {
    fetch("/api/agrofit/vocabulario")
      .then((r) => (r.ok ? r.json() : null))
      .then(setVocabProd)
      .catch(() => setVocabProd(null));
  }, []);

  // Vocabulário dos inoculantes só quando o modo é aberto pela primeira vez.
  useEffect(() => {
    if (modo !== "inoculantes" || vocabInoc) return;
    fetch("/api/bioinsumos/vocabulario")
      .then((r) => (r.ok ? r.json() : null))
      .then(setVocabInoc)
      .catch(() => setVocabInoc(null));
  }, [modo, vocabInoc]);

  const buscar = useCallback(async (m: Modo, f: Filtros, pg: number) => {
    setCarregando(true);
    setErro(null);
    try {
      const url = m === "produtos" ? "/api/agrofit" : "/api/bioinsumos";
      const res = await fetch(`${url}?${parametros(m, f, pg)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha na consulta");
      if (m === "produtos") setProdutos(json);
      else setInoculantes(json);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      if (m === "produtos") setProdutos(null);
      else setInoculantes(null);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    buscar(modo, filtros, pagina);
    // Refaz a busca quando o modo, os filtros ou a página mudam.
  }, [modo, filtros, pagina, buscar]);

  function mudar(campo: keyof Filtros, valor: string | boolean) {
    setPagina(1);
    setFiltros((f) => ({ ...f, [campo]: valor }));
  }

  function aplicarExemplo(parcial: Partial<Filtros>) {
    setModo("produtos");
    setPagina(1);
    setFiltros({ ...VAZIO, ...parcial });
  }

  function abrirInoculantes() {
    if (modo === "inoculantes") return;
    setModo("inoculantes");
    setPagina(1);
    culturas.setAberto(null);
    // Começa sem filtro, nem a cultura: não há inoculante registrado para
    // pitaya, e levar "Pitaya" junto abriria o modo sempre vazio.
    setFiltros(VAZIO);
  }

  const emInoculantes = modo === "inoculantes";
  const temFiltro = Object.entries(filtros).some(([, v]) => v !== "" && v !== false);
  const extrasAtivos = (
    emInoculantes
      ? [filtros.q, filtros.tipo, filtros.uf]
      : [filtros.q, filtros.ingrediente, filtros.titular, filtros.classe, filtros.bio, filtros.organico]
  ).filter((v) => v !== "" && v !== false).length;
  const dados = emInoculantes ? inoculantes : produtos;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 px-5 pt-6 pb-8 md:px-8 md:pt-8">
      <CabecalhoProdutos />

      {emInoculantes ? (
        <PainelFiltros
          key="inoculantes"
          extrasAtivos={extrasAtivos}
          principais={
            <>
              <Campo
                rotulo="Cultura"
                valor={filtros.cultura}
                aoMudar={(v) => mudar("cultura", v)}
                lista={vocabInoc?.culturas}
                listaId="inoc-culturas"
                dica="Ex.: Soja, Feijão"
                icone="broto"
              />
              <Campo
                rotulo="Espécie"
                valor={filtros.especie}
                aoMudar={(v) => mudar("especie", v)}
                lista={vocabInoc?.especies}
                listaId="inoc-especies"
                dica="Ex.: Bradyrhizobium"
                icone="busca"
              />
            </>
          }
          extras={
            <>
              <Campo rotulo="Registro ou empresa" valor={filtros.q} aoMudar={(v) => mudar("q", v)} dica="Ex.: PR0023604-19, Forbio" />
              <Campo
                rotulo="Tipo"
                valor={filtros.tipo}
                aoMudar={(v) => mudar("tipo", v)}
                lista={vocabInoc?.tipos}
                listaId="inoc-tipos"
                dica="Ex.: fixadora de nitrogênio"
              />
              <Campo
                rotulo="UF"
                valor={filtros.uf}
                aoMudar={(v) => mudar("uf", v)}
                lista={vocabInoc?.ufs}
                listaId="inoc-ufs"
                dica="Sigla do estado do registro"
              />
            </>
          }
        />
      ) : (
        <PainelFiltros
          key="produtos"
          extrasAtivos={extrasAtivos}
          principais={
            <>
              <Campo
                rotulo="Praga ou doença"
                valor={filtros.praga}
                aoMudar={(v) => mudar("praga", v)}
                lista={vocabProd?.pragas}
                listaId="pragas"
                dica="Nome comum ou científico"
                icone="busca"
              />
              <Campo
                rotulo="Cultura"
                valor={filtros.cultura}
                aoMudar={(v) => mudar("cultura", v)}
                lista={vocabProd?.culturas}
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
                lista={vocabProd?.ingredientes}
                listaId="ingredientes"
                dica="Ex.: Difenoconazol, Bacillus"
              />
              <Campo
                rotulo="Titular do registro"
                valor={filtros.titular}
                aoMudar={(v) => mudar("titular", v)}
                lista={vocabProd?.titulares}
                listaId="titulares"
              />
              <Campo
                rotulo="Classe agronômica"
                valor={filtros.classe}
                aoMudar={(v) => mudar("classe", v)}
                lista={vocabProd?.classes}
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
      )}

      <div className="trilho-rolavel -mx-5 flex gap-2 overflow-x-auto pr-10 pl-5 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {EXEMPLOS.map((e) => (
          <Chip
            key={e.rotulo}
            ativo={!emInoculantes && igual(filtros, e.filtros)}
            aoClicar={() => aplicarExemplo(e.filtros)}
          >
            {e.rotulo}
          </Chip>
        ))}
        <Chip ativo={emInoculantes} aoClicar={abrirInoculantes}>
          Inoculantes
        </Chip>
        {(temFiltro || emInoculantes) && (
          <button
            type="button"
            onClick={() => aplicarExemplo({})}
            className="min-h-10 shrink-0 px-2 text-sm font-bold text-acento-texto"
          >
            Limpar
          </button>
        )}
      </div>

      {emInoculantes ? (
        <p className="text-sm leading-snug text-texto-2">
          Inoculantes são microrganismos que ajudam a planta a crescer — como as bactérias que fixam
          nitrogênio. Não são defensivos e não combatem praga.
        </p>
      ) : (
        <AvisoReceituario />
      )}

      <Contagem
        texto={
          carregando
            ? "Consultando…"
            : emInoculantes
              ? inoculantes && !erro
                ? `${inoculantes.total.toLocaleString("pt-BR")} registro(s)` +
                  (inoculantes.atualizadoEm ? ` · cadastro de ${inoculantes.atualizadoEm}` : "")
                : ""
              : produtos && !erro
                ? `${produtos.total.toLocaleString("pt-BR")} produto(s)`
                : ""
        }
      />

      {erro && <Erro texto={erro} />}

      {/* O aviso do "Todas as culturas" é o ponto sutil: sem ele o usuário acha
          que o produto foi registrado nominalmente para a cultura dele, quando
          o registro é genérico. */}
      {!emInoculantes && produtos && filtros.cultura && produtos.viaTodasAsCulturas > 0 && !carregando && (
        <p className="rounded-2xl bg-alerta-suave px-3.5 py-3 text-[13px] leading-snug text-alerta-texto">
          {produtos.viaTodasAsCulturas} dos {produtos.total} valem por{" "}
          <strong>&ldquo;Todas as culturas&rdquo;</strong> — registro geral, que inclui {filtros.cultura}{" "}
          sem citá-la. Esses cartões vêm marcados.
        </p>
      )}

      {carregando && !dados && <Carregando />}

      {/* Base não coletada e registro inexistente são coisas diferentes. */}
      {emInoculantes && inoculantes?.baseVazia && !carregando && (
        <Vazio titulo="A base de inoculantes ainda não foi coletada.">
          Esta página lê a cópia no Postgres, não a API da Embrapa. Rode{" "}
          <code>npm run bioinsumos:sync</code> uma vez (leva ~40s) e recarregue.
        </Vazio>
      )}

      {dados && dados.total === 0 && !(emInoculantes && inoculantes?.baseVazia) && !carregando && (
        <Vazio titulo="Nenhum registro para esses filtros.">
          Isso normalmente significa que o registro não existe mesmo. Só confirme que a cultura foi
          escolhida da lista — a busca compara com a grafia exata do MAPA (&ldquo;Pitaya&rdquo;, não
          &ldquo;pitaia&rdquo;).
        </Vazio>
      )}

      {!emInoculantes && produtos && produtos.itens.length > 0 && (
        <div className={`grid gap-3 md:grid-cols-2 xl:grid-cols-3 ${carregando ? "opacity-60" : ""}`}>
          {produtos.itens.map((it) => (
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
                todasAsCulturas: it.via_todas_as_culturas,
                registro: it.registration,
                url: it.url_agrofit,
                titular: it.holder,
                toxicologica: it.toxicological_class,
                ambiental: it.environmental_class,
                formulacao: it.formulacao,
                alvos: produtos.temAlvos ? it.alvos : null,
                nCulturas: it.n_culturas,
                modoAcao: it.modo_acao,
              }}
            />
          ))}
        </div>
      )}

      {emInoculantes && inoculantes && inoculantes.itens.length > 0 && (
        <div className={`grid gap-3 md:grid-cols-2 xl:grid-cols-3 ${carregando ? "opacity-60" : ""}`}>
          {inoculantes.itens.map((it, i) => (
            <CartaoInoculante key={`${it.registro_produto}-${it.cultura}-${i}`} it={it} />
          ))}
        </div>
      )}

      {dados && <Paginacao pagina={dados.pagina} paginas={dados.paginas} aoMudar={setPagina} />}

      {emInoculantes && (
        <p className="text-xs leading-snug text-suave">
          Inoculante é registrado por empresa e cultura — o mesmo produto aparece uma vez para cada
          cultura em que foi registrado.
        </p>
      )}
    </main>
  );
}

function CartaoInoculante({ it }: { it: Inoculante }) {
  return (
    <article className={`${classeCartao} flex flex-col gap-3 p-4`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[17px] leading-snug font-bold italic">{it.especie ?? "Espécie não informada"}</h3>
          <p className="mt-0.5 text-sm text-texto-2">{it.razao_social ?? "—"}</p>
        </div>
        {it.tipo && <Etiqueta tom="acento">{it.tipo}</Etiqueta>}
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-[13px]">
        <div className="min-w-0">
          <dt className="text-suave">Registro</dt>
          <dd className="mt-0.5 font-semibold break-words">{it.registro_produto ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-suave">UF · atividade</dt>
          <dd className="mt-0.5 font-semibold">
            {it.uf ?? "—"} · {it.atividade?.toLowerCase() ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-suave">Cultura</dt>
          <dd className="mt-0.5 font-semibold">
            {it.cultura ?? "—"}
            {it.cultura_nome_cientifico && (
              <span className="block font-normal text-suave italic">{it.cultura_nome_cientifico}</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-suave">Garantia</dt>
          <dd className="mt-0.5 font-semibold">{it.garantia ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-suave">Natureza</dt>
          <dd className="mt-0.5 font-semibold">{it.natureza_fisica ?? "—"}</dd>
        </div>
      </dl>
    </article>
  );
}
