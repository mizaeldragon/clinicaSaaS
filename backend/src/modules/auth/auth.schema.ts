import { z } from 'zod';
import { CompanyType } from '@prisma/client';

export const loginSchema = z.object({
  email: z.string().email('E-mail inválido').toLowerCase().trim(),
  password: z.string().min(1, 'Informe a senha'),
  /** Usado apenas quando o mesmo e-mail existe em mais de uma empresa. */
  companySlug: z.string().trim().optional(),
});

export const registerCompanySchema = z.object({
  company: z.object({
    name: z.string().min(2, 'Nome da empresa muito curto').max(120),
    type: z.nativeEnum(CompanyType).default(CompanyType.OTHER),
    phone: z.string().max(20).optional(),
    document: z.string().max(20).optional(),
  }),
  admin: z.object({
    name: z.string().min(2, 'Informe seu nome').max(120),
    email: z.string().email('E-mail inválido').toLowerCase().trim(),
    password: z
      .string()
      .min(8, 'A senha deve ter no mínimo 8 caracteres')
      .max(72, 'A senha deve ter no máximo 72 caracteres'),
    phone: z.string().max(20).optional(),
  }),
  planSlug: z.string().optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10, 'Refresh token inválido'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual'),
  newPassword: z.string().min(8, 'A nova senha deve ter no mínimo 8 caracteres').max(72),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('E-mail inválido').toLowerCase().trim(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20, 'Link inválido'),
  newPassword: z.string().min(8, 'A nova senha deve ter no mínimo 8 caracteres').max(72),
});

/** Seis dígitos do aplicativo ou um código de recuperação (`a1b2-c3d4`). */
const twoFactorCode = z
  .string()
  .trim()
  .min(6, 'Informe o código')
  .max(12, 'Código inválido');

export const twoFactorLoginSchema = z.object({
  challengeToken: z.string().min(20),
  code: twoFactorCode,
});

export const twoFactorEnableSchema = z.object({ code: twoFactorCode });

export const twoFactorDisableSchema = z.object({
  password: z.string().min(1, 'Informe a senha'),
  code: twoFactorCode,
});

export type LoginDTO = z.infer<typeof loginSchema>;
export type RegisterCompanyDTO = z.infer<typeof registerCompanySchema>;
export type RefreshDTO = z.infer<typeof refreshSchema>;
export type ChangePasswordDTO = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordDTO = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordDTO = z.infer<typeof resetPasswordSchema>;
