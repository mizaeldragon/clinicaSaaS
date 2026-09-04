import type { UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface AuthenticatedUser {
      id: string;
      companyId: string | null;
      role: UserRole;
      permissions: string[];
      professionalId?: string | null;
      /** Locatária: aluga um espaço da empresa e tem carteira própria. */
      isRenter?: boolean;
    }

    interface Request {
      user?: AuthenticatedUser;
      companyId?: string;
      enabledModules?: string[];
    }
  }
}

export {};
