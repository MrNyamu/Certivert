import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// Mock functions
const getCachedContractService = jest.fn();
const isValidHash = jest.fn();

describe('POST /api/revoke', () => {
  let app;
  let revokeRouter;
  let mockContractService;

  beforeAll(async () => {
    // Create mocks using unstable_mockModule
    await jest.unstable_mockModule('../src/services/contractFactory.js', () => ({
      getCachedContractService
    }));

    await jest.unstable_mockModule('../src/services/hash.js', () => ({
      computeCertHash: jest.fn(),
      computeFileHash: jest.fn(),
      isValidHash
    }));

    // Import the router after mocking
    const { default: router } = await import('../src/routes/revoke.js');
    revokeRouter = router;

    // Import error handler
    const { errorHandler } = await import('../src/middleware/errorHandler.js');

    // Create test app
    app = express();
    app.use(express.json());
    app.use('/api/revoke', revokeRouter);
    app.use(errorHandler); // Add error handler middleware
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock contract service
    mockContractService = {
      revokeCertificate: jest.fn(),
      verifyCertificate: jest.fn(),
      getKeyByRole: jest.fn(),
    };

    getCachedContractService.mockResolvedValue(mockContractService);
    mockContractService.getKeyByRole.mockReturnValue('test-private-key');
    isValidHash.mockReturnValue(true); // Default to valid hash format
  });

  const validCertId = 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456';
  const validRevokeData = {
    certId: validCertId,
    callerRole: 'university'  // Using callerRole not revokerRole
  };

  describe('Successful revocation', () => {
    test('should revoke certificate with university role', async () => {
      // Mock certificate verification (certificate exists and not revoked)
      mockContractService.verifyCertificate.mockResolvedValue({
        status: 'VALID',
        certificate: { studentName: 'John Doe' }
      });
      mockContractService.revokeCertificate.mockResolvedValue('revoke-tx-id-123');

      const response = await request(app)
        .post('/api/revoke')
        .send(validRevokeData);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        certId: validCertId,
        txId: 'revoke-tx-id-123',
        status: 'revoked',
        revokedBy: 'university',
        message: 'Certificate revoked successfully'
      });

      expect(mockContractService.verifyCertificate).toHaveBeenCalledWith(validCertId);
      expect(mockContractService.revokeCertificate).toHaveBeenCalledWith(
        validCertId,
        'test-private-key'
      );
    });

    test('should revoke certificate with KNQA role', async () => {
      const knqaRevokeData = { ...validRevokeData, callerRole: 'knqa' };
      
      mockContractService.verifyCertificate.mockResolvedValue({
        status: 'VALID',
        certificate: { studentName: 'Jane Doe' }
      });
      mockContractService.revokeCertificate.mockResolvedValue('revoke-tx-id-456');

      const response = await request(app)
        .post('/api/revoke')
        .send(knqaRevokeData);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        certId: validCertId,
        txId: 'revoke-tx-id-456',
        status: 'revoked',
        revokedBy: 'knqa'
      });

      expect(mockContractService.getKeyByRole).toHaveBeenCalledWith('knqa');
    });
  });

  describe('Validation errors', () => {
    test('should return 400 if certId is missing', async () => {
      const response = await request(app)
        .post('/api/revoke')
        .send({
          callerRole: 'university'
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Missing required fields: certId and callerRole',
        code: 'MISSING_FIELDS'
      });
    });

    test('should return 400 if callerRole is missing', async () => {
      const response = await request(app)
        .post('/api/revoke')
        .send({
          certId: validCertId
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Missing required fields: certId and callerRole',
        code: 'MISSING_FIELDS'
      });
    });

    test('should return 400 if callerRole is invalid', async () => {
      const response = await request(app)
        .post('/api/revoke')
        .send({
          certId: validCertId,
          callerRole: 'student'  // Invalid role
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Invalid caller role. Must be "university" or "knqa"',
        code: 'INVALID_ROLE'
      });
    });

    test('should return 400 for invalid certId format', async () => {
      isValidHash.mockReturnValue(false); // Mock invalid hash

      const response = await request(app)
        .post('/api/revoke')
        .send({
          certId: 'invalid-cert-id',
          callerRole: 'university'
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Invalid certificate ID format',
        code: 'INVALID_CERT_ID'
      });

      expect(isValidHash).toHaveBeenCalledWith('invalid-cert-id');
    });
  });

  describe('Business logic errors', () => {
    test('should handle certificate not found', async () => {
      mockContractService.verifyCertificate.mockResolvedValue({
        status: 'NOT_FOUND',
        certificate: null
      });

      const response = await request(app)
        .post('/api/revoke')
        .send(validRevokeData);

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        error: 'Certificate not found',
        code: 'CERT_NOT_FOUND'
      });
    });

    test('should handle already revoked certificate', async () => {
      mockContractService.verifyCertificate.mockResolvedValue({
        status: 'REVOKED',
        certificate: { studentName: 'John Doe' }
      });

      const response = await request(app)
        .post('/api/revoke')
        .send(validRevokeData);

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        error: 'Certificate is already revoked',
        code: 'ALREADY_REVOKED'
      });
    });

    test('should handle unauthorized revocation attempt', async () => {
      mockContractService.verifyCertificate.mockResolvedValue({
        status: 'VALID',
        certificate: { studentName: 'John Doe' }
      });
      mockContractService.revokeCertificate.mockRejectedValue(new Error('not authorized'));

      const response = await request(app)
        .post('/api/revoke')
        .send(validRevokeData);

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        error: 'Not authorized to revoke this certificate',
        code: 'NOT_AUTHORIZED'
      });
    });
  });

  describe('Service failures', () => {
    test('should handle blockchain service failure', async () => {
      mockContractService.verifyCertificate.mockResolvedValue({
        status: 'VALID',
        certificate: { studentName: 'John Doe' }
      });
      mockContractService.revokeCertificate.mockRejectedValue(new Error('blockchain connection failed'));

      const response = await request(app)
        .post('/api/revoke')
        .send(validRevokeData);

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        error: 'Blockchain service unavailable',
        code: 'BLOCKCHAIN_ERROR'
      });
    });

    test('should handle contract transaction failure', async () => {
      mockContractService.verifyCertificate.mockResolvedValue({
        status: 'VALID',
        certificate: { studentName: 'John Doe' }
      });
      mockContractService.revokeCertificate.mockRejectedValue(new Error('contract'));

      const response = await request(app)
        .post('/api/revoke')
        .send(validRevokeData);

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        error: 'Blockchain service unavailable',
        code: 'BLOCKCHAIN_ERROR'
      });
    });
  });
});