import { Response } from 'express';

export enum ErrorCode {
  // Client errors (4xx)
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  
  // Server errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
}

interface ErrorResponse {
  code: ErrorCode;
  message: string;
  details?: any;
}

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function sendError(
  res: Response,
  statusCode: number,
  code: ErrorCode,
  message: string,
  details?: any
): void {
  const response: ErrorResponse = {
    code,
    message,
    ...(details && { details }),
  };

  res.status(statusCode).json(response);
}

export function handleError(res: Response, error: unknown): void {
  console.error('Error:', error);

  // Handle known AppError instances
  if (error instanceof AppError) {
    return sendError(res, error.statusCode, error.code, error.message, error.details);
  }

  // Handle validation errors (Zod)
  if (error && typeof error === 'object' && 'issues' in error) {
    return sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Validation failed', error);
  }

  // Handle generic errors
  if (error instanceof Error) {
    return sendError(res, 500, ErrorCode.INTERNAL_ERROR, error.message);
  }

  // Fallback for unknown errors
  sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'An unexpected error occurred');
}

// Common error helpers
export const errors = {
  notFound: (resource: string) =>
    new AppError(ErrorCode.NOT_FOUND, 404, `${resource} not found`),
  
  badRequest: (message: string, details?: any) =>
    new AppError(ErrorCode.BAD_REQUEST, 400, message, details),
  
  unauthorized: (message: string = 'Unauthorized') =>
    new AppError(ErrorCode.UNAUTHORIZED, 401, message),
  
  forbidden: (message: string = 'Forbidden') =>
    new AppError(ErrorCode.FORBIDDEN, 403, message),
  
  validation: (message: string, details?: any) =>
    new AppError(ErrorCode.VALIDATION_ERROR, 400, message, details),
  
  internal: (message: string = 'Internal server error') =>
    new AppError(ErrorCode.INTERNAL_ERROR, 500, message),
  
  database: (message: string = 'Database operation failed') =>
    new AppError(ErrorCode.DATABASE_ERROR, 500, message),
};
