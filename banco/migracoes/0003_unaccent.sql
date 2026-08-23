-- A página de bioinsumos passou a ler do Postgres em vez da API em memória.
--
-- A filtragem em JavaScript comparava texto normalizado (minúsculo e sem
-- acento), então "ingrediente=acao" achava "ação". ILIKE puro não faz isso:
-- sem unaccent, trocar a fonte de dados seria uma regressão silenciosa de
-- busca — o usuário digitaria certo e veria zero resultado.
CREATE EXTENSION IF NOT EXISTS unaccent;
