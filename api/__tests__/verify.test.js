import request from 'supertest';
import express from 'express';
import verifyRouter from '../src/routes/verify.js';

// Mock dependencies
jest.mock('../src/services/contractFactory.js');
import { getCachedContractService } from '../src/services/contractFactory.js';

// Create test app
const app = express();
app.use(express.json());
app.use('/api/verify', verifyRouter);

// Mock contract service
const mockContractService = {
  verifyCertificate: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  getCachedContractService.mockResolvedValue(mockContractService);
});

describe('POST /api/verify', () => {
  const validCertId = 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456';

  describe('Successful verification', () => {
    test('should verify valid certificate', async () => {
      const mockCertificate = {
        status: 'VALID',
        certificate: {
          'student-name': 'John Doe',
          'admission-no': 'ADM001',
          programme: 'Computer Science',
          year: 2023,
          grade: 'First Class',
          'ipfs-cid': 'QmTestCID123456789',
          'issued-by': 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
          'issued-at': 12345,
          revoked: false
        }
      };

      mockContractService.verifyCertificate.mockResolvedValue(mockCertificate);

      const response = await request(app)
        .post('/api/verify')
        .send({ certId: validCertId });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        certId: validCertId,
        status: 'VALID',
        certificate: expect.objectContaining({
          studentName: 'John Doe',
          admissionNo: 'ADM001',
          programme: 'Computer Science',
          year: 2023,
          grade: 'First Class',
          ipfsCid: 'QmTestCID123456789',
          issuedBy: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
          issuedAt: 12345,
          revoked: false
        })
      });

      expect(mockContractService.verifyCertificate).toHaveBeenCalledWith(validCertId);
    });

    test('should handle revoked certificate', async () => {
      const mockRevokedCert = {
        status: 'REVOKED',
        certificate: {
          'student-name': 'Jane Doe',
          'admission-no': 'ADM002',
          programme: 'Engineering',
          year: 2022,
          grade: 'Second Class',
          'ipfs-cid': 'QmTestCID987654321',
          'issued-by': 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
          'issued-at': 11111,
          revoked: true,
          'revoked-by': 'ST2REHHS5J3CERCRBEPMGH7921Q6PYKAQS7J7XW2',
          'revoked-at': 13333
        }
      };

      mockContractService.verifyCertificate.mockResolvedValue(mockRevokedCert);

      const response = await request(app)
        .post('/api/verify')
        .send({ certId: validCertId });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        certId: validCertId,
        status: 'REVOKED',
        certificate: expect.objectContaining({
          studentName: 'Jane Doe',
          revoked: true,
          revokedBy: 'ST2REHHS5J3CERCRBEPMGH7921Q6PYKAQS7J7XW2',
          revokedAt: 13333
        })
      });
    });

    test('should handle certificate not found', async () => {
      const mockNotFound = {
        status: 'NOT_FOUND',
        certificate: null
      };

      mockContractService.verifyCertificate.mockResolvedValue(mockNotFound);

      const response = await request(app)
        .post('/api/verify')
        .send({ certId: validCertId });

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        certId: validCertId,
        status: 'NOT_FOUND',
        message: 'Certificate not found'
      });
    });
  });

  describe('Validation errors', () => {
    test('should return 400 if certId is missing', async () => {
      const response = await request(app)
        .post('/api/verify')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Certificate ID is required',
        code: 'MISSING_CERT_ID'
      });
    });

    test('should return 400 if certId is empty', async () => {
      const response = await request(app)
        .post('/api/verify')
        .send({ certId: '   ' });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Certificate ID is required',
        code: 'MISSING_CERT_ID'
      });
    });

    test('should return 400 if certId format is invalid', async () => {
      const response = await request(app)
        .post('/api/verify')
        .send({ certId: 'invalid-cert-id' });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Invalid certificate ID format',
        code: 'INVALID_CERT_ID'
      });
    });

    test('should validate certId length (64 characters)', async () => {
      const shortCertId = 'a1b2c3d4e5f6';

      const response = await request(app)
        .post('/api/verify')
        .send({ certId: shortCertId });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Invalid certificate ID format',
        code: 'INVALID_CERT_ID'
      });
    });
  });

  describe('Service failures', () => {
    test('should handle blockchain service failure', async () => {
      mockContractService.verifyCertificate.mockRejectedValue(new Error('Blockchain connection failed'));

      const response = await request(app)
        .post('/api/verify')
        .send({ certId: validCertId });

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        error: 'Blockchain service unavailable',
        code: 'BLOCKCHAIN_ERROR'
      });
    });

    test('should handle contract call timeout', async () => {
      mockContractService.verifyCertificate.mockRejectedValue(new Error('Contract call timeout'));

      const response = await request(app)
        .post('/api/verify')
        .send({ certId: validCertId });

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        error: 'Blockchain service unavailable',
        code: 'BLOCKCHAIN_ERROR'
      });
    });
  });
});