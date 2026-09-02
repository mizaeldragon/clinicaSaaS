import { Prisma } from '@prisma/client';
import { prisma } from '../../shared/database/prisma';
import { tenantContext } from '../../shared/database/tenantContext';
import { BadRequestError, ConflictError, NotFoundError, PlanLimitError } from '../../shared/errors/AppError';
import { hashPassword } from '../../shared/utils/hash';
import { getPagination, paginated } from '../../shared/utils/http';
import { getCompanyContext } from '../../shared/services/companyContext.service';
import type { CreateUserDTO, ListUsersDTO, UpdateUserDTO } from './users.schema';

const SAFE_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  avatarUrl: true,
  role: true,
  permissions: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  professional: { select: { id: true, name: true } },
} satisfies Prisma.UserSelect;

export const usersService = {
  async list(companyId: string, query: ListUsersDTO) {
    const pagination = getPagination(query);

    const where: Prisma.UserWhereInput = {
      companyId,
      ...(query.role ? { role: query.role } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await tenantContext.runAsSystem(() =>
      Promise.all([
        prisma.user.findMany({
          where,
          select: SAFE_SELECT,
          orderBy: { name: 'asc' },
          skip: pagination.skip,
          take: pagination.take,
        }),
        prisma.user.count({ where }),
      ]),
    );

    return paginated(data, total, pagination);
  },

  async get(companyId: string, id: string) {
    const user = await tenantContext.runAsSystem(() =>
      prisma.user.findFirst({ where: { id, companyId }, select: SAFE_SELECT }),
    );
    if (!user) throw new NotFoundError('Usuário');
    return user;
  },

  async create(companyId: string, dto: CreateUserDTO) {
    return tenantContext.runAsSystem(async () => {
      const context = await getCompanyContext(companyId);
      const maxUsers = context?.plan?.maxUsers ?? null;

      if (maxUsers !== null) {
        const current = await prisma.user.count({ where: { companyId, isActive: true } });
        if (current >= maxUsers) {
          throw new PlanLimitError(
            `Seu plano permite até ${maxUsers} usuários ativos. Faça upgrade para adicionar mais.`,
            { limit: maxUsers, current },
          );
        }
      }

      const duplicated = await prisma.user.findFirst({ where: { companyId, email: dto.email } });
      if (duplicated) throw new ConflictError('Já existe um usuário com este e-mail nesta empresa');

      if (dto.professionalId) {
        const professional = await prisma.professional.findFirst({
          where: { id: dto.professionalId, companyId },
        });
        if (!professional) throw new NotFoundError('Profissional');
        if (professional.userId) throw new ConflictError('Este profissional já possui um usuário vinculado');
      }

      const user = await prisma.user.create({
        data: {
          companyId,
          name: dto.name,
          email: dto.email,
          phone: dto.phone,
          role: dto.role,
          permissions: dto.permissions ?? [],
          passwordHash: await hashPassword(dto.password),
          ...(dto.professionalId
            ? { professional: { connect: { id: dto.professionalId } } }
            : {}),
        },
        select: SAFE_SELECT,
      });

      return user;
    });
  },

  async update(companyId: string, id: string, dto: UpdateUserDTO, currentUserId: string) {
    return tenantContext.runAsSystem(async () => {
      const user = await prisma.user.findFirst({ where: { id, companyId } });
      if (!user) throw new NotFoundError('Usuário');

      if (dto.isActive === false && id === currentUserId) {
        throw new BadRequestError('Você não pode desativar o próprio usuário');
      }

      if (dto.email && dto.email !== user.email) {
        const duplicated = await prisma.user.findFirst({
          where: { companyId, email: dto.email, id: { not: id } },
        });
        if (duplicated) throw new ConflictError('Já existe um usuário com este e-mail');
      }

      const data: Prisma.UserUpdateInput = {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.permissions !== undefined ? { permissions: dto.permissions } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.password ? { passwordHash: await hashPassword(dto.password) } : {}),
      };

      if (dto.professionalId !== undefined) {
        data.professional = dto.professionalId
          ? { connect: { id: dto.professionalId } }
          : { disconnect: true };
      }

      const updated = await prisma.user.update({ where: { id }, data, select: SAFE_SELECT });

      // Alterações sensíveis encerram as sessões ativas do usuário.
      if (dto.password || dto.isActive === false || dto.role) {
        await prisma.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      return updated;
    });
  },

  async remove(companyId: string, id: string, currentUserId: string) {
    if (id === currentUserId) throw new BadRequestError('Você não pode remover o próprio usuário');

    return tenantContext.runAsSystem(async () => {
      const user = await prisma.user.findFirst({ where: { id, companyId } });
      if (!user) throw new NotFoundError('Usuário');

      const admins = await prisma.user.count({
        where: { companyId, role: 'COMPANY_ADMIN', isActive: true },
      });
      if (user.role === 'COMPANY_ADMIN' && admins <= 1) {
        throw new BadRequestError('A empresa precisa de ao menos um administrador ativo');
      }

      // Desativação lógica preserva histórico e auditoria.
      await prisma.user.update({ where: { id }, data: { isActive: false } });
      await prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  },
};
