import { RequestHandler } from 'express';
import { AnyZodObject, ZodError, ZodTypeAny } from 'zod';
import { BadRequestError } from '../errors/AppError';

interface ValidationSchemas {
  body?: ZodTypeAny;
  query?: AnyZodObject;
  params?: AnyZodObject;
}

function formatIssues(error: ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}

/** Valida e NORMALIZA body/query/params com Zod antes de chegar ao controller. */
export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req, _res, next) => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params);
      if (schemas.query) {
        const parsedQuery = schemas.query.parse(req.query);
        Object.defineProperty(req, 'query', { value: parsedQuery, writable: true });
      }
      if (schemas.body) req.body = schemas.body.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(new BadRequestError('Dados inválidos', formatIssues(error)));
        return;
      }
      next(error);
    }
  };
}
