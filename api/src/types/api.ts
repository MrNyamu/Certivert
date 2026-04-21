/**
 * API request/response types and middleware types
 */

import { Request, Response, NextFunction } from 'express';

// Generic API response wrapper
export interface ApiResponse<T = any> {
  success?: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
  timestamp?: string;
}

// Error response type
export interface ApiError {
  error: string;
  code?: string;
  message?: string;
  details?: any;
  timestamp: string;
}

// Health check response
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'error';
  timestamp: string;
  services: {
    api: string;
    ipfs: {
      status: string;
      connected: boolean;
    };
    blockchain: {
      status: string;
      [key: string]: any;
    };
  };
  version: string;
  network: string;
  contractAddress: string;
}

// Extended Express Request with file upload
// Using Express.Multer.File type from @types/express
export interface RequestWithFile extends Request {
  file?: Express.Multer.File;
}

// Custom error class
export class AppError extends Error {
  public statusCode: number;
  public code: string | undefined;
  public isOperational: boolean;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Middleware function types
export type MiddlewareFunction = (
  req: Request,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

export type ErrorMiddlewareFunction = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

// Route handler types
export type RouteHandler<T = any> = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void> | void;

export type RouteHandlerWithFile = (
  req: RequestWithFile,
  res: Response,
  next: NextFunction
) => Promise<void> | void;

// Rate limiting configuration
export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: {
    error: string;
    message: string;
  };
  standardHeaders: boolean;
  legacyHeaders: boolean;
}

// CORS configuration
export interface CorsConfig {
  origin: string[];
  credentials: boolean;
  methods: string[];
  allowedHeaders: string[];
}