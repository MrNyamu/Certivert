/**
 * Application Layer Exports
 * Central export point for all application layer services and use cases
 */

// Use Cases
export { IssueCertificateUseCase } from './useCases/IssueCertificateUseCase.js';
export { VerifyCertificateUseCase } from './useCases/VerifyCertificateUseCase.js';
export { RevokeCertificateUseCase, RevocationReasons } from './useCases/RevokeCertificateUseCase.js';

// Application Services
export { CertificateService } from './services/CertificateService.js';
export { AuthService } from './services/AuthService.js';

// Export default service instances for easy consumption
import certificateService from './services/CertificateService.js';
import authService from './services/AuthService.js';

export { certificateService, authService };

// Convenience exports for common operations
export const applicationServices = {
  certificate: certificateService,
  auth: authService
};

export default applicationServices;