import multer from 'multer';

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
  fileFilter: (req, file, cb) => {
    // Check MIME type
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      const error = new Error('Only PDF files are allowed');
      error.code = 'INVALID_FILE_TYPE';
      cb(error, false);
    }
  }
});

// Error handler for multer errors
export function handleUploadError(error, req, res, next) {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        message: 'File size must not exceed 10MB'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files',
        message: 'Only one file is allowed'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: 'Unexpected file field',
        message: 'File must be uploaded in the "pdf" field'
      });
    }
  }
  
  if (error.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      error: 'Invalid file type',
      message: error.message
    });
  }
  
  // Pass other errors to global error handler
  next(error);
}

// Export the configured upload middleware
export default upload;