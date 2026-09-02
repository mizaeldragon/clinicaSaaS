import type { UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface AuthenticatedUser {
      id: string;
      companyId: string | null;
      role: UserRole;
      permissions: string[];
      professionalId?: string | null;
    }

    interface Request {
      user?: AuthenticatedUser;
      companyId?: string;
      enabledModules?: string[];
    }
  }
}

export {};
