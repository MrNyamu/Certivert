/**
 * Enhanced HTTP Client
 * Centralized HTTP client with interceptors, error handling, and retry logic
 */

import axios from 'axios';

// Configuration
const config = {
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000',
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
  maxRetryDelay: 10000
};

// Create axios instance
const httpClient = axios.create({
  baseURL: config.baseURL,
  timeout: config.timeout,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Request interceptor
httpClient.interceptors.request.use(
  (requestConfig) => {
    // Add correlation ID for tracking
    requestConfig.headers['X-Correlation-ID'] = generateCorrelationId();
    
    // Add timestamp
    requestConfig.metadata = { startTime: Date.now() };
    
    // Log request in development
    if (import.meta.env.MODE === 'development') {
      console.log(`🚀 ${requestConfig.method?.toUpperCase()} ${requestConfig.url}`, {
        headers: requestConfig.headers,
        data: requestConfig.data
      });
    }
    
    return requestConfig;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
httpClient.interceptors.response.use(
  (response) => {
    // Calculate request duration
    const duration = Date.now() - (response.config.metadata?.startTime || 0);
    
    // Log successful response in development
    if (import.meta.env.MODE === 'development') {
      console.log(`✅ ${response.config.method?.toUpperCase()} ${response.config.url} (${duration}ms)`, {
        status: response.status,
        data: response.data
      });
    }
    
    // Add metadata to response
    response.metadata = {
      duration,
      correlationId: response.config.headers['X-Correlation-ID']
    };
    
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Calculate request duration
    const duration = Date.now() - (originalRequest?.metadata?.startTime || 0);
    
    // Log error in development
    if (import.meta.env.MODE === 'development') {
      console.error(`❌ ${originalRequest?.method?.toUpperCase()} ${originalRequest?.url} (${duration}ms)`, {
        status: error.response?.status,
        message: error.message,
        data: error.response?.data
      });
    }
    
    // Handle specific error cases
    const enhancedError = enhanceError(error);
    
    // Retry logic for certain types of errors
    if (shouldRetry(error) && !originalRequest._retryAttempt) {
      originalRequest._retryAttempt = 0;
    }
    
    if (originalRequest._retryAttempt < config.retries && shouldRetry(error)) {
      originalRequest._retryAttempt++;
      
      const delay = calculateRetryDelay(originalRequest._retryAttempt);
      
      console.log(`🔄 Retrying request (attempt ${originalRequest._retryAttempt}/${config.retries}) after ${delay}ms`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return httpClient(originalRequest);
    }
    
    return Promise.reject(enhancedError);
  }
);

// Helper functions
function generateCorrelationId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

function shouldRetry(error) {
  // Retry on network errors or 5xx server errors
  return (
    !error.response || // Network error
    (error.response.status >= 500 && error.response.status <= 599) || // Server error
    error.code === 'ECONNABORTED' || // Timeout
    error.code === 'NETWORK_ERROR'
  );
}

function calculateRetryDelay(attempt) {
  // Exponential backoff with jitter
  const baseDelay = config.retryDelay * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 0.1 * baseDelay;
  return Math.min(baseDelay + jitter, config.maxRetryDelay);
}

function enhanceError(error) {
  const enhanced = new Error();
  
  // Copy original error properties
  Object.setPrototypeOf(enhanced, Object.getPrototypeOf(error));
  Object.getOwnPropertyNames(error).forEach(key => {
    enhanced[key] = error[key];
  });
  
  // Add enhanced properties
  enhanced.isNetworkError = !error.response;
  enhanced.isServerError = error.response?.status >= 500;
  enhanced.isClientError = error.response?.status >= 400 && error.response?.status < 500;
  enhanced.correlationId = error.config?.headers['X-Correlation-ID'];
  enhanced.duration = Date.now() - (error.config?.metadata?.startTime || 0);
  
  // Extract meaningful error message
  if (error.response?.data) {
    if (typeof error.response.data === 'string') {
      enhanced.message = error.response.data;
    } else if (error.response.data.message) {
      enhanced.message = error.response.data.message;
    } else if (error.response.data.error) {
      enhanced.message = error.response.data.error;
    }
  }
  
  // Add user-friendly messages
  enhanced.userMessage = getUserFriendlyMessage(enhanced);
  
  return enhanced;
}

function getUserFriendlyMessage(error) {
  if (error.isNetworkError) {
    return 'Network connection failed. Please check your internet connection and try again.';
  }
  
  if (error.response?.status === 401) {
    return 'Authentication required. Please connect your wallet.';
  }
  
  if (error.response?.status === 403) {
    return 'Access denied. You do not have permission to perform this action.';
  }
  
  if (error.response?.status === 404) {
    return 'The requested resource was not found.';
  }
  
  if (error.response?.status === 429) {
    return 'Too many requests. Please wait a moment and try again.';
  }
  
  if (error.isServerError) {
    return 'Server error occurred. Please try again later.';
  }
  
  return error.message || 'An unexpected error occurred.';
}

// HTTP methods with enhanced error handling
export const httpMethods = {
  get: (url, config = {}) => httpClient.get(url, config),
  post: (url, data, config = {}) => httpClient.post(url, data, config),
  put: (url, data, config = {}) => httpClient.put(url, data, config),
  patch: (url, data, config = {}) => httpClient.patch(url, data, config),
  delete: (url, config = {}) => httpClient.delete(url, config)
};

// Upload helper with progress tracking
export const uploadFile = (url, file, onProgress = null, config = {}) => {
  const formData = new FormData();
  formData.append('file', file);
  
  return httpClient.post(url, formData, {
    ...config,
    headers: {
      ...config.headers,
      'Content-Type': 'multipart/form-data'
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percentCompleted);
      }
    }
  });
};

// Download helper
export const downloadFile = async (url, filename, config = {}) => {
  const response = await httpClient.get(url, {
    ...config,
    responseType: 'blob'
  });
  
  // Create download link
  const blob = new Blob([response.data]);
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(downloadUrl);
  
  return response;
};

// Health check
export const healthCheck = async () => {
  try {
    const response = await httpClient.get('/health');
    return {
      healthy: true,
      status: response.data,
      responseTime: response.metadata?.duration
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.userMessage,
      responseTime: error.duration
    };
  }
};

// Configuration getters/setters
export const getConfig = () => ({ ...config });

export const updateConfig = (newConfig) => {
  Object.assign(config, newConfig);
  
  // Update axios instance
  if (newConfig.baseURL) {
    httpClient.defaults.baseURL = newConfig.baseURL;
  }
  if (newConfig.timeout) {
    httpClient.defaults.timeout = newConfig.timeout;
  }
};

export default httpClient;