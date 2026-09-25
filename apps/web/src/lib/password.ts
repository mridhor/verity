import { z } from "zod";

/** Also enforced server-side by Supabase Auth (`minimum_password_length` in supabase/config.toml). */
export const MIN_PASSWORD_LENGTH = 10;

export const newPasswordSchema = z
  .object({
    password: z.string().min(MIN_PASSWORD_LENGTH, `Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter.`).max(72),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Konfirmasi kata sandi tidak sama.", path: ["confirm"] });
