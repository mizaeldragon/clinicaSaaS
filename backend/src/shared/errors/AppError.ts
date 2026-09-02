export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 400, code = 'BAD_REQUEST', details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Requisição inválida', details?: unknown) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Não autenticado') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acesso negado') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Recurso') {
    super(`${resource} não encontrado`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflito de dados', details?: unknown) {
    super(message, 409, 'CONFLICT', details);
  }
}

export class ModuleDisabledError extends AppError {
  constructor(module: string) {
    super(
      `O módulo "${module}" não está habilitado para esta empresa`,
      403,
      'MODULE_DISABLED',
      { module },
    );
  }
}

export class PlanLimitError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 402, 'PLAN_LIMIT_REACHED', details);
  }
}

export class ScheduleConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 409, 'SCHEDULE_CONFLICT', details);
  }
}
