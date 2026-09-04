import { Router, type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../../shared/database/prisma';
import { tenantContext } from '../../shared/database/tenantContext';
import { AppError, NotFoundError } from '../../shared/errors/AppError';
import { validate } from '../../shared/middlewares/validate';
import { asyncHandler, serialize } from '../../shared/utils/http';
import {
  agendaQuerySchema,
  availabilityQuerySchema,
  createPublicAppointmentSchema,
  slugParamSchema,
} from './public.schema';
import {
  createPublicAppointment,
  getPublicAgenda,
  getPublicAvailability,
  getStorefront,
} from './public.service';

export const publicRoutes = Router({ mergeParams: true });

/** A página pública é aberta: limites mais apertados que o resto da API. */
const browseLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { code: 'RATE_LIMITED', message: 'Muitas requisições. Aguarde um instante.' },
  },
});

const bookingLimiter = rateLimit({
  windowMs: 10 * 60_000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Muitas tentativas de agendamento. Tente novamente em alguns minutos.',
    },
  },
});

/**
 * Resolve a empresa pelo slug da URL e abre o contexto multi-tenant.
 * Sem isso, nenhuma consulta do Prisma funciona nas rotas públicas.
 */
const resolveCompany: RequestHandler = asyncHandler(async (req, _res, next) => {
  const { slug } = req.params as { slug: string };

  const company = await tenantContext.runAsSystem(() =>
    prisma.company.findUnique({
      where: { slug },
      select: {
        id: true,
        status: true,
        publicBookingEnabled: true,
        publicRequiresApproval: true,
        modules: { where: { enabled: true }, select: { module: true } },
      },
    }),
  );

  if (!company) throw new NotFoundError('Página');

  if (!company.publicBookingEnabled) {
    throw new AppError('Esta empresa não tem agendamento online ativo', 404, 'PUBLIC_BOOKING_OFF');
  }

  if (company.status === 'SUSPENDED' || company.status === 'CANCELED') {
    throw new AppError('Esta página está temporariamente indisponível', 403, 'COMPANY_BLOCKED');
  }

  if (!company.modules.some((m) => m.module === 'appointments')) {
    throw new AppError('Agendamento indisponível', 404, 'MODULE_DISABLED');
  }

  req.companyId = company.id;
  (req as unknown as { requiresApproval: boolean }).requiresApproval =
    company.publicRequiresApproval;

  tenantContext.run({ companyId: company.id, userId: null, bypassTenant: false }, () => next());
});

publicRoutes.use(browseLimiter, validate({ params: slugParamSchema }), resolveCompany);

/** Vitrine: dados da empresa, categorias, serviços e profissionais. */
publicRoutes.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(serialize(await getStorefront(req.companyId as string)));
  }),
);

/** Dias com horário livre para um serviço (pinta o calendário). */
publicRoutes.get(
  '/agenda/:serviceId',
  validate({
    params: slugParamSchema.extend({ serviceId: z.string().uuid('Serviço inválido') }),
    query: agendaQuerySchema,
  }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as { from: Date; days: number };
    res.json(serialize(await getPublicAgenda(req.params.serviceId, query.from, query.days)));
  }),
);

/** Horários livres de um serviço em uma data, por profissional. */
publicRoutes.get(
  '/availability',
  validate({ query: availabilityQuerySchema }),
  asyncHandler(async (req, res) => {
    res.json(serialize(await getPublicAvailability(req.query as never)));
  }),
);

publicRoutes.post(
  '/appointments',
  bookingLimiter,
  validate({ body: createPublicAppointmentSchema }),
  asyncHandler(async (req, res) => {
    const requiresApproval = (req as unknown as { requiresApproval: boolean }).requiresApproval;
    const appointment = await createPublicAppointment(
      req.companyId as string,
      requiresApproval,
      req.body,
    );
    res.status(201).json(serialize(appointment));
  }),
);
