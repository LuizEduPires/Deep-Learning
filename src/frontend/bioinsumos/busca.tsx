"use client";

import { useCallback, useEffect, useState } from "react";
import { Campo, Chip, Etiqueta, Segmentado, classeCartao } from "../ui";
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
    { rotulo: "Uso orgânico", filtros: { organico: true } },
  ],
  inoculantes: [
    { rotulo: "Para soja", filtros: { cultura: "Soja" } },
    { rotulo: "Bradyrhizobium", filtros: { especie: "Bradyrhizobium" } },
    { rotulo: "Registrados em SP", filtros: { uf: "SP" } },
  ],
};

function igual(a: Filtros, b: Partial<Filtros>) {
  return JSON.stringify(a) === JSON.stringify({ ...VAZIO, ...b });
}

export default function BuscaBioinsumos() {
  const [aba, setAba] = useState<Aba>("produtos");
  const [filtros, setFiltros] = useState<Filtros>(VAZIO);
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<Resultado | null>(null);
  const [vocab, setVocab] = useState<Vocabulario | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const culturas = usarCulturas("/api/bioinsumos/culturas");

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
    culturas.setAberto(null);
    // A cultura sobrevive à troca: é o único filtro comum às duas abas, e
    // perdê-la faria o usuário redigitar para ver o outro lado do mesmo tema.
    setFiltros({ ...VAZIO, cultura: filtros.cultura });
  }

  const temFiltro = Object.entries(filtros).some(([, v]) => v !== "" && v !== false);
  const produtos = dados?.aba === "produtos" ? (dados.itens as Produto[]) : [];
  const inoculantes = dados?.aba === "inoculantes" ? (dados.itens as Inoculante[]) : [];
  const extrasAtivos = (
    aba === "produtos"
      ? [filtros.q, filtros.ingrediente, filtros.titular, filtros.classe, filtros.organico]
      : [filtros.q, filtros.uf]
  ).filter((v) => v !== "" && v !== false).length;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 px-5 pt-6 pb-8 md:px-8 md:pt-8">
      <CabecalhoProdutos base="bioinsumos" />

      <div className="max-w-md">
        <Segmentado
          rotulo="Tipo de bioinsumo"
          valor={aba}
          aoMudar={trocarAba}
          opcoes={[
            { valor: "produtos", rotulo: "Controle de pragas" },
            { valor: "inoculantes", rotulo: "Inoculantes" },
          ]}
        />
      </div>

      {aba === "produtos" ? (
        <PainelFiltros
          key="produtos"
          extrasAtivos={extrasAtivos}
          principais={
            <>
              <Campo
                rotulo="Praga ou doença"
                valor={filtros.praga}
                aoMudar={(v) => mudar("praga", v)}
                lista={vocab?.pragas}
                listaId="bio-pragas"
                dica="Nome comum ou científico"
                icone="busca"
              />
              <Campo
                rotulo="Cultura"
                valor={filtros.cultura}
                aoMudar={(v) => mudar("cultura", v)}
                lista={vocab?.culturas}
                listaId="bio-culturas"
                dica="Inclui os de uso geral"
                icone="broto"
              />
            </>
          }
          extras={
            <>
              <Campo rotulo="Produto ou nº de registro" valor={filtros.q} aoMudar={(v) => mudar("q", v)} dica="Ex.: Dipel, 24618" />
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
              <div className="flex items-end">
                <Caixinha rotulo="Uso orgânico" marcado={filtros.organico} aoMudar={(v) => mudar("organico", v)} />
              </div>
            </>
          }
        />
      ) : (
        <PainelFiltros
          key="inoculantes"
          extrasAtivos={extrasAtivos}
          principais={
            <>
              <Campo
                rotulo="Cultura"
                valor={filtros.cultura}
                aoMudar={(v) => mudar("cultura", v)}
                lista={vocab?.culturas}
                listaId="bio-culturas"
                dica="Ex.: Soja, Feijão"
                icone="broto"
              />
              <Campo
                rotulo="Espécie"
                valor={filtros.especie}
                aoMudar={(v) => mudar("especie", v)}
                lista={vocab?.especies}
                listaId="bio-especies"
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
          }
        />
      )}

      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {EXEMPLOS[aba].map((e) => (
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
              ? `${dados.total.toLocaleString("pt-BR")} ${dados.aba === "produtos" ? "produto(s)" : "registro(s)"}` +
                (dados.atualizadoEm ? ` · cadastro de ${dados.atualizadoEm}` : "")
              : ""
        }
      />

      {erro && <Erro texto={erro} />}

      {/* O aviso do "Todas as culturas" é o ponto sutil desta base: sem ele o
          usuário acha que o produto foi registrado nominalmente para a cultura
          dele, quando o registro é genérico. */}
      {dados?.aba === "produtos" && filtros.cultura && (dados.viaTodasAsCulturas ?? 0) > 0 && !carregando && (
        <p className="rounded-2xl bg-alerta-suave px-3.5 py-3 text-[13px] leading-snug text-alerta-texto">
          {dados.viaTodasAsCulturas} dos {dados.total} casaram por{" "}
          <strong>&ldquo;Todas as culturas&rdquo;</strong> — registro geral, que vale para{" "}
          {filtros.cultura} sem citá-la. Esses cartões vêm marcados.
        </p>
      )}

      {carregando && !dados && <Carregando />}

      {/* Base não coletada e registro inexistente são coisas diferentes, e
          tratar as duas como "nenhum resultado" faria o usuário concluir que
          não há bioinsumo para a cultura dele. */}
      {dados?.baseVazia && !carregando && (
        <Vazio titulo="A base local ainda não foi coletada.">
          Esta página lê a cópia no Postgres, não a API da Embrapa. Rode{" "}
          <code>npm run bioinsumos:sync</code> uma vez (leva ~40s) e recarregue.
        </Vazio>
      )}

      {dados && dados.total === 0 && !dados.baseVazia && !carregando && (
        <Vazio titulo="Nenhum registro para esses filtros.">
          A base de bioinsumos é pequena — 834 produtos biológicos e 1.032 inoculantes —, então isso
          costuma significar que o registro não existe mesmo. Confira a grafia da cultura: a busca
          compara com o nome do MAPA (&ldquo;Pitaya&rdquo;, não &ldquo;pitaia&rdquo;).
        </Vazio>
      )}

      {produtos.length > 0 && (
        <div className={`grid gap-3 md:grid-cols-2 xl:grid-cols-3 ${carregando ? "opacity-60" : ""}`}>
          {produtos.map((it) => (
            <CartaoProduto
              key={it.numero_registro ?? it.nome}
              aberto={culturas.aberto === it.numero_registro}
              culturas={it.numero_registro ? culturas.culturas[it.numero_registro] : undefined}
              aoAlternar={() => culturas.alternar(it.numero_registro)}
              p={{
                chave: it.numero_registro ?? it.nome,
                nome: it.nome,
                ingrediente: it.ingrediente_ativo,
                classe: it.classe,
                biologico: true,
                organico: it.organico,
                todasAsCulturas: it.via_todas_as_culturas,
                registro: it.numero_registro,
                url: it.url_agrofit,
                titular: it.titular,
                toxicologica: it.toxicologica,
                ambiental: it.ambiental,
                formulacao: it.formulacao,
                alvos: dados?.temAlvos ? it.alvos : null,
                nCulturas: it.n_culturas,
                modoAcao: it.modo_acao,
                tecnicaAplicacao: it.tecnica_aplicacao,
              }}
            />
          ))}
        </div>
      )}

      {inoculantes.length > 0 && (
        <div className={`grid gap-3 md:grid-cols-2 xl:grid-cols-3 ${carregando ? "opacity-60" : ""}`}>
          {inoculantes.map((it, i) => (
            <article key={`${it.registro_produto}-${it.cultura}-${i}`} className={`${classeCartao} flex flex-col gap-3 p-4`}>
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
          ))}
        </div>
      )}

      {dados && <Paginacao pagina={dados.pagina} paginas={dados.paginas} aoMudar={setPagina} />}

      <p className="text-xs leading-snug text-suave">
        Inoculante é registrado por empresa e cultura — o mesmo produto aparece uma vez para cada
        cultura em que foi registrado.
      </p>
    </main>
  );
}
