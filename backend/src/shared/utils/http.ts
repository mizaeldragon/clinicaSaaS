import { NextFunction, Request, RequestHandler, Response } from 'express';

/** Envolve controllers async para encaminhar erros ao middleware central. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export interface PaginationParams {
  page: number;
  perPage: number;
  skip: number;
  take: number;
}

export function getPagination(query: { page?: number; perPage?: number }): PaginationParams {
  const page = Math.max(1, Number(query.page) || 1);
  const perPage = Math.min(100, Math.max(1, Number(query.perPage) || 20));
  return { page, perPage, skip: (page - 1) * perPage, take: perPage };
}

export function paginated<T>(data: T[], total: number, { page, perPage }: PaginationParams) {
  return {
    data,
    meta: {
      page,
      perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
    },
  };
}

/** Converte Decimal do Prisma (e estruturas aninhadas) em number para o JSON da API. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serialize<T>(value: T): any {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  // Prisma.Decimal expõe toNumber()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyValue = value as any;
  if (typeof anyValue.toNumber === 'function' && typeof anyValue.toFixed === 'function') {
    return anyValue.toNumber();
  }
  if (Array.isArray(value)) return value.map(serialize);
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = serialize(val);
  }
  return out;
}
