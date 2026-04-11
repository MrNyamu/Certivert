import request from 'supertest';
import express from 'express';
import revokeRouter from '../src/routes/revoke.js';

// Mock dependencies
jest.mock('../src/services/contractFactory.js');
import { getCachedContractService } from '../src/services/contractFactory.js';

// Create test app
const app = express();
app.use(express.json());
app.use('/api/revoke', revokeRouter);

// Mock contract service
const mockContractService = {
  revokeCertificate: jest.fn(),
  getKeyByRole: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  getCachedContractService.mockResolvedValue(mockContractService);
  mockContractService.getKeyByRole.mockReturnValue('test-private-key');
});

describe('POST /api/revoke', () => {
  const validCertId = 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456';
  const validRevokeData = {
    certId: validCertId,
    reason: 'Academic misconduct discovered',
    revokerRole: 'university'
  };

  describe('Successful revocation', () => {
    test('should revoke certificate with university role', async () => {
      mockContractService.revokeCertificate.mockResolvedValue('revoke-tx-id-123');

      const response = await request(app)
        .post('/api/revoke')
        .send(validRevokeData);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        certId: validCertId,
        txId: 'revoke-tx-id-123',
        status: 'revoked',
        reason: 'Academic misconduct discovered',
        revokedBy: 'university',
        message: 'Certificate revoked successfully'
      });

      expect(mockContractService.revokeCertificate).toHaveBeenCalledWith(
        validCertId,
        'test-private-key'
      );
    });

    test('should revoke certificate with KNQA role', async () => {
      const knqaRevokeData = { ...validRevokeData, revokerRole: 'knqa' };
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

    test('should handle revocation without reason', async () => {
      const dataWithoutReason = {
        certId: validCertId,
        revokerRole: 'university'
      };
      
      mockContractService.revokeCertificate.mockResolvedValue('revoke-tx-id-789');

      const response = await request(app)
        .post('/api/revoke')
        .send(dataWithoutReason);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        certId: validCertId,
        status: 'revoked',
        reason: 'No reason provided'
      });
    });
  });

  describe('Validation errors', () => {
    test('should return 400 if certId is missing', async () => {
      const response = await request(app)
        .post('/api/revoke')
        .send({
          reason: 'Test reason',
          revokerRole: 'university'
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Certificate ID is required',
        code: 'MISSING_CERT_ID'
      });
    });

    test('should return 400 if revokerRole is missing', async () => {
      const response = await request(app)
        .post('/api/revoke')
        .send({
          certId: validCertId,
          reason: 'Test reason'
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Revoker role is required',
        code: 'MISSING_REVOKER_ROLE'
      });
    });

    test('should return 400 if revokerRole is invalid', async () => {
      const response = await request(app)
        .post('/api/revoke')
        .send({
          certId: validCertId,
          reason: 'Test reason',
          revokerRole: 'student'  // Invalid role
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Invalid revoker role. Must be university or knqa',
        code: 'INVALID_REVOKER_ROLE'
      });
    });

    test('should return 400 for invalid certId format', async () => {
      const response = await request(app)
        .post('/api/revoke')
        .send({
          certId: 'invalid-cert-id',
          revokerRole: 'university'
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Invalid certificate ID format',
        code: 'INVALID_CERT_ID'
      });
    });
  });

  describe('Business logic errors', () => {
    test('should handle certificate not found', async () => {
      mockContractService.revokeCertificate.mockRejectedValue(new Error('Certificate not found'));

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
      mockContractService.revokeCertificate.mockRejectedValue(new Error('Certificate already revoked'));

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
      mockContractService.revokeCertificate.mockRejectedValue(new Error('Not authorized to revoke'));

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
      mockContractService.revokeCertificate.mockRejectedValue(new Error('Blockchain connection failed'));

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
      mockContractService.revokeCertificate.mockRejectedValue(new Error('Transaction failed'));

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