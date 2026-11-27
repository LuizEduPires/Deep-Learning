import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .email("Informe um e-mail válido.")
  .max(254, "O e-mail deve ter no máximo 254 caracteres.");

export const loginSchema = z.object({
  email: emailSchema,
  senha: z.string().min(1, "Informe sua senha.").max(200),
});

export const cadastroSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: emailSchema,
    senha: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(200),
    confirmarSenha: z.string().min(1, "Confirme sua senha.").max(200),
  })
  .refine((dados) => dados.senha === dados.confirmarSenha, {
    message: "A confirmação não é igual à senha.",
    path: ["confirmarSenha"],
  });
