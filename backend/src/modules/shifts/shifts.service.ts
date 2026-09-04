import { prisma } from '../../shared/database/prisma';
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors/AppError';
import type { CreateShiftDTO, SetShiftPricesDTO, UpdateShiftDTO } from './shifts.schema';

/** Turnos padrão sugeridos quando a empresa ainda não configurou nenhum. */
export const DEFAULT_SHIFTS = [
  { name: 'Manhã', startsAt: '08:00', endsAt: '12:00', sortOrder: 1 },
  { name: 'Tarde', startsAt: '13:00', endsAt: '18:00', sortOrder: 2 },
  { name: 'Noite', startsAt: '18:00', endsAt: '22:00', sortOrder: 3 },
];

export const shiftsService = {
  async list(onlyActive = false) {
    return prisma.shift.findMany({
      where: onlyActive ? { isActive: true } : {},
      orderBy: [{ sortOrder: 'asc' }, { startsAt: 'asc' }],
      include: {
        prices: { include: { resource: { select: { id: true, name: true } } } },
        _count: { select: { bookings: true } },
      },
    });
  },

  async get(id: string) {
    const shift = await prisma.shift.findFirst({ where: { id } });
    if (!shift) throw new NotFoundError('Turno');
    return shift;
  },

  async create(companyId: string, dto: CreateShiftDTO) {
    return prisma.shift.create({ data: { ...dto, companyId } });
  },

  async update(id: string, dto: UpdateShiftDTO) {
    const shift = await this.get(id);

    const startsAt = dto.startsAt ?? shift.startsAt;
    const endsAt = dto.endsAt ?? shift.endsAt;
    if (startsAt >= endsAt) {
      throw new BadRequestError('O fim do turno deve ser depois do início');
    }

    return prisma.shift.update({ where: { id }, data: dto });
  },

  async remove(id: string) {
    await this.get(id);

    const bookings = await prisma.rentalBooking.count({
      where: { shiftId: id, status: { not: 'CANCELED' } },
    });
    if (bookings > 0) {
      // Preserva o histórico de reservas: desativa em vez de excluir.
      return prisma.shift.update({ where: { id }, data: { isActive: false } });
    }

    await prisma.resourceShiftPrice.deleteMany({ where: { shiftId: id } });
    return prisma.shift.delete({ where: { id } });
  },

  /** Cria os turnos padrão (Manhã/Tarde/Noite) para uma empresa nova. */
  async seedDefaults(companyId: string) {
    const existing = await prisma.shift.count();
    if (existing > 0) throw new ConflictError('Esta empresa já possui turnos configurados');

    await prisma.shift.createMany({
      data: DEFAULT_SHIFTS.map((shift) => ({ ...shift, companyId })),
    });

    return this.list();
  },

  /** Tabela de preços: quanto custa cada turno em cada espaço locável. */
  async priceTable() {
    const [resources, shifts, prices] = await Promise.all([
      prisma.resource.findMany({
        where: { isRentable: true, isActive: true },
        orderBy: { name: 'asc' },
        include: { category: { select: { id: true, name: true } } },
      }),
      prisma.shift.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
      prisma.resourceShiftPrice.findMany(),
    ]);

    return {
      shifts,
      resources: resources.map((resource) => ({
        id: resource.id,
        name: resource.name,
        category: resource.category,
        dailyRate: resource.dailyRate,
        shiftPrices: shifts.map((shift) => ({
          shiftId: shift.id,
          price: prices.find((p) => p.resourceId === resource.id && p.shiftId === shift.id)?.price ?? null,
        })),
      })),
    };
  },

  async setPrices(companyId: string, dto: SetShiftPricesDTO) {
    const resource = await prisma.resource.findFirst({ where: { id: dto.resourceId } });
    if (!resource) throw new NotFoundError('Recurso');

    await prisma.$transaction(
      dto.prices.map((entry) =>
        prisma.resourceShiftPrice.upsert({
          where: { resourceId_shiftId: { resourceId: dto.resourceId, shiftId: entry.shiftId } },
          create: {
            companyId,
            resourceId: dto.resourceId,
            shiftId: entry.shiftId,
            price: entry.price,
          },
          update: { price: entry.price },
        }),
      ),
    );

    return this.priceTable();
  },

  /**
   * Preço de um turno em um recurso, com fallback para a diária do recurso.
   * Usado ao criar uma reserva.
   */
  async resolvePrice(resourceId: string, shiftId: string | null): Promise<number> {
    if (!shiftId) {
      const resource = await prisma.resource.findFirst({ where: { id: resourceId } });
      return Number(resource?.dailyRate ?? 0);
    }

    const price = await prisma.resourceShiftPrice.findFirst({ where: { resourceId, shiftId } });
    if (price) return Number(price.price);

    const resource = await prisma.resource.findFirst({ where: { id: resourceId } });
    return Number(resource?.dailyRate ?? 0);
  },
};
