/**
 * Type definitions index
 * Centralizes all type exports for easy importing
 */

// Certificate-related types
export * from './certificate.js';

// Blockchain and Stacks types
export * from './blockchain.js';

// API types
export * from './api.js';

// Service interfaces
export * from './services.js';

// Import types for type guards
import type { 
  CertificateData, 
  UserRoleType 
} from './certificate.js';

// Type guards for runtime type checking
export const isValidCertificateData = (data: any): data is CertificateData => {
  return (
    data &&
    typeof data === 'object' &&
    typeof data.studentName === 'string' &&
    typeof data.admissionNo === 'string' &&
    typeof data.programme === 'string' &&
    typeof data.year === 'number' &&
    typeof data.grade === 'string'
  );
};

export const isValidUserRole = (role: any): role is UserRoleType => {
  return typeof role === 'number' && role >= 0 && role <= 3;
};

export const isValidCertificateStatus = (status: any): status is number => {
  return typeof status === 'number' && [100, 200, 300, 400].includes(status);
};