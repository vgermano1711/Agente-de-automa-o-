import { z } from "zod";

export const contactFormSchema = z.object({
  name: z.string().trim().min(2, "Digite seu nome completo.").max(80, "Nome muito longo."),
  phone: z
    .string()
    .trim()
    .min(10, "Digite um telefone válido com DDD.")
    .max(20, "Telefone muito longo.")
    .regex(/^[\d\s()+-]+$/, "Use apenas números, espaços e símbolos de telefone."),
  email: z.string().trim().email("Digite um e-mail válido."),
  message: z
    .string()
    .trim()
    .min(10, "Conta com mais detalhes — pelo menos 10 caracteres.")
    .max(500, "Mensagem muito longa (máximo 500 caracteres)."),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;
