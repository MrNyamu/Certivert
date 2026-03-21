/**
 * Global error handler for Express application
 * Logs errors and returns appropriate JSON responses
 */
export function errorHandler(err, req, res, next) {
  // Log the error for debugging (but don't expose details to client)
  console.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });
  
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
}

/**
 * 404 handler for unmatched routes
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'Route not found',
    code: 'NOT_FOUND',
    message: `Cannot ${req.method} ${req.path}`
  });
}

/**
 * Creates an error with specific status code and code
 */
export function createError(statusCode, message, code = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) {
    error.code = code;
  }
  return error;
}