-- Classificações resumidas para reconstruir contexto de imagem em histórico.
-- Os bytes enviados nunca são armazenados.
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS leaf_inference jsonb;
