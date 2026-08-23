-- Configurações da aplicação editáveis em runtime, uma linha por chave.
--
-- Nasceu para o painel de troca de LLM: até aqui provedor e modelo só saíam de
-- LLM_PROVIDER/LLM_MODEL, e trocar significava editar .env e reiniciar o
-- servidor. O .env continua valendo como padrão — a linha "llm" aqui, quando
-- existe, tem precedência; apagá-la devolve o controle ao ambiente.
--
-- Chaves de API continuam FORA daqui, no .env: o painel não tem autenticação e
-- segredo em banco lido pela UI é vazamento esperando acontecer.
CREATE TABLE IF NOT EXISTS configuracoes (
  chave text PRIMARY KEY,
  valor jsonb NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
