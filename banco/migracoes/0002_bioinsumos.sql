-- Coleta da API Bioinsumos (AgroAPI/Embrapa) — o recorte biológico do mesmo
-- cadastro do MAPA: produtos biológicos para controle de pragas e inoculantes.
--
-- Mesmo desenho do Agrofit: o payload cru de toda coleção fica em
-- bioinsumos_itens, e as duas coleções que a aplicação consulta ganham tabelas
-- normalizadas. O cru é o seguro contra mudança de layout — remapeia-se dali
-- sem baixar tudo de novo.

CREATE TABLE IF NOT EXISTS bioinsumos_itens (
  colecao text NOT NULL,
  chave text NOT NULL,
  payload jsonb NOT NULL,
  sincronizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (colecao, chave)
);
CREATE INDEX IF NOT EXISTS bioinsumos_itens_colecao_idx ON bioinsumos_itens (colecao);
CREATE INDEX IF NOT EXISTS bioinsumos_itens_payload_idx
  ON bioinsumos_itens USING gin (payload jsonb_path_ops);

-- Estado por coleção: quantos registros a API declarou, quantos chegaram e
-- quando. É o que permite conferir se a coleta terminou inteira.
CREATE TABLE IF NOT EXISTS bioinsumos_colecoes (
  colecao text PRIMARY KEY,
  registros_api int,
  registros_gravados int NOT NULL DEFAULT 0,
  paginas int,
  ultimo_erro text,
  sincronizado_em timestamptz NOT NULL DEFAULT now()
);

-- Produtos biológicos (controle de pragas). numero_registro é a PK real do
-- sistema do MAPA e não se repete nesta coleção.
CREATE TABLE IF NOT EXISTS bioinsumos_produtos (
  numero_registro text PRIMARY KEY,
  marca_comercial text NOT NULL DEFAULT '',
  titular_registro text,
  classe_categoria text,
  formulacao text,
  ingrediente_ativo text,
  modo_acao text,
  tecnica_aplicacao text,
  classificacao_toxicologica text,
  classificacao_ambiental text,
  agricultura_organica boolean,
  inflamavel boolean,
  corrosivo boolean,
  url_agrofit text,
  payload jsonb,
  sincronizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bioinsumos_produtos_marca_trgm
  ON bioinsumos_produtos USING gin (marca_comercial gin_trgm_ops);
CREATE INDEX IF NOT EXISTS bioinsumos_produtos_ia_trgm
  ON bioinsumos_produtos USING gin (ingrediente_ativo gin_trgm_ops);

-- indicacao_uso explodida: uma linha por produto × cultura × praga.
--
-- todas_as_culturas é a coluna que faz esta base ser útil em SQL. 795 dos 834
-- produtos estão cadastrados sob "Todas as culturas", não sob a cultura do
-- produtor. Sem a marca, "existe bioinsumo para pitaya?" responderia zero —
-- com ela, a consulta é:
--
--   WHERE cultura ILIKE '%pitaya%' OR todas_as_culturas
CREATE TABLE IF NOT EXISTS bioinsumos_indicacoes (
  id serial PRIMARY KEY,
  numero_registro text NOT NULL,
  cultura text NOT NULL,
  praga_nome_cientifico text NOT NULL DEFAULT '',
  praga_nome_comum text NOT NULL DEFAULT '',
  todas_as_culturas boolean NOT NULL DEFAULT false,
  UNIQUE (numero_registro, cultura, praga_nome_cientifico, praga_nome_comum)
);
CREATE INDEX IF NOT EXISTS bioinsumos_indicacoes_registro_idx
  ON bioinsumos_indicacoes (numero_registro);
CREATE INDEX IF NOT EXISTS bioinsumos_indicacoes_todas_idx
  ON bioinsumos_indicacoes (todas_as_culturas);
CREATE INDEX IF NOT EXISTS bioinsumos_indicacoes_cultura_trgm
  ON bioinsumos_indicacoes USING gin (cultura gin_trgm_ops);
CREATE INDEX IF NOT EXISTS bioinsumos_indicacoes_praga_comum_trgm
  ON bioinsumos_indicacoes USING gin (praga_nome_comum gin_trgm_ops);
CREATE INDEX IF NOT EXISTS bioinsumos_indicacoes_praga_cient_trgm
  ON bioinsumos_indicacoes USING gin (praga_nome_cientifico gin_trgm_ops);

-- Inoculantes. A coleção traz uma linha por produto × cultura (1.032 produtos
-- viram 1.239 linhas), então registro_produto NÃO é único aqui: a PK é a mesma
-- chave usada em bioinsumos_itens, que já desempata pelo hash do payload
-- quando registro + cultura + espécie se repetem.
CREATE TABLE IF NOT EXISTS bioinsumos_inoculantes (
  chave text PRIMARY KEY,
  registro_produto text NOT NULL,
  razao_social text,
  uf text,
  atividade text,
  tipo text,
  especie text,
  cultura text,
  cultura_nome_cientifico text,
  garantia text,
  natureza_fisica text,
  data_registro date,
  payload jsonb,
  sincronizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bioinsumos_inoculantes_registro_idx
  ON bioinsumos_inoculantes (registro_produto);
CREATE INDEX IF NOT EXISTS bioinsumos_inoculantes_uf_idx
  ON bioinsumos_inoculantes (uf);
CREATE INDEX IF NOT EXISTS bioinsumos_inoculantes_cultura_trgm
  ON bioinsumos_inoculantes USING gin (cultura gin_trgm_ops);
CREATE INDEX IF NOT EXISTS bioinsumos_inoculantes_especie_trgm
  ON bioinsumos_inoculantes USING gin (especie gin_trgm_ops);
