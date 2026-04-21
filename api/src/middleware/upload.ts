import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';
import type { ErrorMiddlewareFunction } from '../types/index.js';

// Define custom error type for file uploads
interface FileUploadError extends Error {
  code?: string;
}

// Configure multer for PDF file uploads
const upload = multer({
  // Use memory storage (no disk writes)
  storage: multer.memoryStorage(),
  
  // File size limit: 10MB
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB in bytes
    files: 1 // Only one file at a time
  },
  
  // File filter: accept only PDF files
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Check MIME type
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      const error: FileUploadError = new Error('Only PDF files are allowed');
      error.code = 'INVALID_FILE_TYPE';
      cb(error);
    }
  }
});

/**
 * Error handler for multer upload errors
 * @param error - Upload error
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next function
 */
export const handleUploadError: ErrorMiddlewareFunction = (
  error: any, 
  req: Request, 
  res: Response, 
  next: NextFunction
): void => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        error: 'File too large',
        message: 'File size must not exceed 10MB'
      });
      return;
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      res.status(400).json({
        error: 'Too many files',
        message: 'Only one file is allowed'
      });
      return;
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      res.status(400).json({
        error: 'Unexpected file field',
        message: 'File must be uploaded in the "pdf" field'
      });
      return;
    }
  }
  
  if (error.code === 'INVALID_FILE_TYPE') {
    res.status(400).json({
      error: 'Invalid file type',
      message: error.message
    });
    return;
  }
  
  // Pass other errors to global error handler
  next(error);
};

// Export the configured upload middleware
export default upload;