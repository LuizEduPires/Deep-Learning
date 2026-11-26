import assert from "node:assert/strict";
import test from "node:test";
import { cadastroSchema, emailSchema, loginSchema } from "../src/auth/validacao";

test("valida e normaliza e-mail no login", () => {
  assert.equal(emailSchema.parse("  pessoa@exemplo.com  "), "pessoa@exemplo.com");
  assert.equal(loginSchema.safeParse({ email: "invalido", senha: "senha" }).success, false);
  assert.equal(
    loginSchema.safeParse({ email: "pessoa@exemplo.com", senha: "senha" }).success,
    true,
  );
});

test("exige confirmação igual à senha no cadastro", () => {
  const dados = {
    name: "Maria Souza",
    email: "maria@exemplo.com",
    senha: "senha-segura",
    confirmarSenha: "senha-segura",
  };
  assert.equal(cadastroSchema.safeParse(dados).success, true);
  assert.equal(
    cadastroSchema.safeParse({ ...dados, confirmarSenha: "outra-senha" }).success,
    false,
  );
});

test("mantém o mínimo de oito caracteres para senha no cadastro", () => {
  assert.equal(
    cadastroSchema.safeParse({
      name: "Maria Souza",
      email: "maria@exemplo.com",
      senha: "curta",
      confirmarSenha: "curta",
    }).success,
    false,
  );
});
