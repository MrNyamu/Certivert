import type { Request, Response, NextFunction } from 'express';
import type { ErrorMiddlewareFunction } from '../types/index.js';
import { AppError } from '../types/index.js';

// Extended Error interface for application errors
interface ExtendedError extends Error {
  statusCode?: number;
  code?: string;
  sensitive?: boolean;
  name: string;
}

/**
 * Global error handler for Express application
 * Logs errors and returns appropriate JSON responses
 */
export const errorHandler: ErrorMiddlewareFunction = (
  err: ExtendedError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log the error for debugging (but don't expose details to client)
  // In test environment, use console.log to avoid red error output
  const logMethod = process.env.NODE_ENV === 'test' ? console.log : console.error;
  const logPrefix = process.env.NODE_ENV === 'test' ? '[TEST ERROR]' : 'Error occurred:';
  
  // In test environment, exclude stack trace for cleaner output
  const logData = process.env.NODE_ENV === 'test' 
    ? {
        message: err.message,
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString()
      }
    : {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString()
      };
  
  logMethod(logPrefix, logData);
  
  // Default error response
  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  let message = 'An internal server error occurred';
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Invalid request data';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
    message = 'Authentication required';
  } else if (err.code === 'ENOENT') {
    statusCode = 404;
    errorCode = 'NOT_FOUND';
    message = 'Resource not found';
  } else if (err.code === 'ECONNREFUSED') {
    statusCode = 503;
    errorCode = 'SERVICE_UNAVAILABLE';
    message = 'External service unavailable';
  }
  
  // Handle custom application errors
  if (err.statusCode) {
    statusCode = err.statusCode;
  }
  
  if (err.code && typeof err.code === 'string') {
    errorCode = err.code;
  }
  
  if (err.message && !err.sensitive) {
    message = err.message;
  }
  
  // Send error response
  res.status(statusCode).json({
    error: message,
    code: errorCode,
    ...(process.env.NODE_ENV === 'development' && {
      // Include stack trace in development only
      stack: err.stack
    })
  });
};

/**
 * 404 handler for unmatched routes
 * @param req - Express request
 * @param res - Express response
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'Route not found',
    code: 'NOT_FOUND',
    message: `Cannot ${req.method} ${req.path}`
  });
}

/**
 * Creates an error with specific status code and code
 * @param statusCode - HTTP status code
 * @param message - Error message
 * @param code - Error code (optional)
 * @returns Custom error object
 */
export function createError(statusCode: number, message: string, code: string | null = null): AppError {
  const error = new AppError(message, statusCode, code || undefined);
  return error;
}