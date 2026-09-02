import { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError';
import { env } from '../../config/env';
import { logger } from '../utils/logger';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: { code: 'ROUTE_NOT_FOUND', message: `Rota não encontrada: ${req.method} ${req.originalUrl}` },
  });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[] | undefined)?.filter((t) => t !== 'companyId');
      res.status(409).json({
        error: {
          code: 'UNIQUE_CONSTRAINT',
          message: `Já existe um registro com este valor${target?.length ? `: ${target.join(', ')}` : ''}`,
        },
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Registro não encontrado' } });
      return;
    }
    if (err.code === 'P2003') {
      res.status(409).json({
        error: {
          code: 'FOREIGN_KEY',
          message: 'Não é possível concluir: existem registros vinculados a este item',
        },
      });
      return;
    }
  }

  logger.error({ err }, 'Erro não tratado');

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Erro interno do servidor',
      ...(env.isProduction ? {} : { stack: (err as Error)?.stack }),
    },
  });
};
