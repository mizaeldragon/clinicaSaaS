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

export type LoginDTO = z.infer<typeof loginSchema>;
export type RegisterCompanyDTO = z.infer<typeof registerCompanySchema>;
export type RefreshDTO = z.infer<typeof refreshSchema>;
export type ChangePasswordDTO = z.infer<typeof changePasswordSchema>;
