-- Coleta completa da API Agrofit (AgroAPI/Embrapa).
--
-- agrofit_itens guarda o payload cru de TODA coleção da API. O layout do
-- Agrofit muda entre publicações e a normalização é sempre uma perda: o cru
-- fica aqui para que uma mudança de mapeamento não exija baixar tudo de novo.

CREATE TABLE IF NOT EXISTS agrofit_itens (
  colecao text NOT NULL,
  chave text NOT NULL,
  payload jsonb NOT NULL,
  sincronizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (colecao, chave)
);
CREATE INDEX IF NOT EXISTS agrofit_itens_colecao_idx ON agrofit_itens (colecao);
CREATE INDEX IF NOT EXISTS agrofit_itens_payload_idx
  ON agrofit_itens USING gin (payload jsonb_path_ops);

-- Estado por coleção: quantos registros a API declarou, quantos chegaram e
-- quando. É o que permite conferir se a coleta terminou inteira.
CREATE TABLE IF NOT EXISTS agrofit_colecoes (
  colecao text PRIMARY KEY,
  registros_api int,
  registros_gravados int NOT NULL DEFAULT 0,
  paginas int,
  ultimo_erro text,
  sincronizado_em timestamptz NOT NULL DEFAULT now()
);

-- indicacao_uso explodida em linhas. Sem isso, "existe produto registrado
-- para pitaya?" vira ILIKE sobre uma string concatenada — que casa
-- "pitaya" dentro de qualquer texto e não distingue cultura de praga.
CREATE TABLE IF NOT EXISTS agrofit_indicacoes (
  id serial PRIMARY KEY,
  registration text NOT NULL,
  cultura text NOT NULL,
  praga_nome_cientifico text NOT NULL DEFAULT '',
  praga_nome_comum text NOT NULL DEFAULT '',
  UNIQUE (registration, cultura, praga_nome_cientifico, praga_nome_comum)
);
CREATE INDEX IF NOT EXISTS agrofit_indicacoes_registration_idx
  ON agrofit_indicacoes (registration);
CREATE INDEX IF NOT EXISTS agrofit_indicacoes_cultura_trgm
  ON agrofit_indicacoes USING gin (cultura gin_trgm_ops);
CREATE INDEX IF NOT EXISTS agrofit_indicacoes_praga_comum_trgm
  ON agrofit_indicacoes USING gin (praga_nome_comum gin_trgm_ops);
CREATE INDEX IF NOT EXISTS agrofit_indicacoes_praga_cient_trgm
  ON agrofit_indicacoes USING gin (praga_nome_cientifico gin_trgm_ops);

-- Campos que só a API traz (o CSV dos Dados Abertos não tem todos).
ALTER TABLE agrofit_products ADD COLUMN IF NOT EXISTS fonte text;
ALTER TABLE agrofit_products ADD COLUMN IF NOT EXISTS formulacao text;
ALTER TABLE agrofit_products ADD COLUMN IF NOT EXISTS modo_acao text;
ALTER TABLE agrofit_products ADD COLUMN IF NOT EXISTS tecnica_aplicacao text;
ALTER TABLE agrofit_products ADD COLUMN IF NOT EXISTS produto_biologico boolean;
ALTER TABLE agrofit_products ADD COLUMN IF NOT EXISTS agricultura_organica boolean;
ALTER TABLE agrofit_products ADD COLUMN IF NOT EXISTS inflamavel boolean;
ALTER TABLE agrofit_products ADD COLUMN IF NOT EXISTS corrosivo boolean;
ALTER TABLE agrofit_products ADD COLUMN IF NOT EXISTS url_agrofit text;
CREATE INDEX IF NOT EXISTS agrofit_products_name_trgm
  ON agrofit_products USING gin (product_name gin_trgm_ops);
