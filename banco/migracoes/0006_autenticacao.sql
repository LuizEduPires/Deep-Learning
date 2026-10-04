-- Login por e-mail e senha, e uma sessão por aparelho.
--
-- `users` existe desde a 0000 e `properties`/`conversations` já apontam para
-- ela; até aqui todo mundo caía no mesmo usuário demo. A senha fica nula para
-- quem já existia (o demo), que assim não consegue entrar — os dados dele
-- continuam no banco, só sem dono acessível.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;

-- O cookie carrega um token aleatório; aqui fica só o SHA-256 dele, para que
-- um dump do banco não vire sessão válida.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

-- E-mail é comparado em minúsculas; o índice garante que "A@x" e "a@x" não
-- virem duas contas.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));
