import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  fields?: Record<string, string[]>;
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'An unexpected error occurred';
  let fields: Record<string, string[]> | undefined = err.fields;

  // Handle Zod Validation Error
  if (err instanceof ZodError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    fields = {};
    for (const issue of err.issues) {
      const path = issue.path.join('.') || 'root';
      if (!fields[path]) fields[path] = [];
      fields[path]!.push(issue.message);
    }
  }

  // Handle Mongoose duplicate key error (E11000)
  if (err.code === 11000) {
    statusCode = 409;
    // Check if slot taken duplicate error on Appointment
    if (err.keyPattern && err.keyPattern.doctorId && err.keyPattern.startAt) {
      code = 'SLOT_TAKEN';
      message = 'This appointment slot has just been booked by another patient. Please select another slot.';
    } else {
      code = 'DUPLICATE_ENTRY';
      message = 'A resource with this identifier already exists';
    }
  }

  // Handle Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 404;
    code = 'NOT_FOUND';
    message = 'Resource not found';
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'UNAUTHORIZED';
    message = 'Invalid or expired token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Token has expired';
  }

  // Do not log stack traces for 4xx errors
  if (statusCode >= 500) {
    logger.error('Unhandled server error:', {
      message: err.message,
      stack: env.NODE_ENV !== 'production' ? err.stack : undefined,
      url: req.originalUrl,
      method: req.method,
    });
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(fields ? { fields } : {}),
    },
  });
}
