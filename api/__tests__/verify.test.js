import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// Mock functions
const getCachedContractService = jest.fn();
const fetchFromIPFS = jest.fn();
const computeFileHash = jest.fn();
const isValidHash = jest.fn();

describe('GET /api/verify/:certId', () => {
  let app;
  let verifyRouter;
  let mockContractService;

  beforeAll(async () => {
    // Create mocks using unstable_mockModule
    await jest.unstable_mockModule('../src/services/contractFactory.js', () => ({
      getCachedContractService
    }));

    await jest.unstable_mockModule('../src/services/ipfs.js', () => ({
      fetchFromIPFS,
      uploadToIPFS: jest.fn(),
      pinCID: jest.fn(),
      checkIPFSConnection: jest.fn(),
      closeIPFSClient: jest.fn()
    }));

    await jest.unstable_mockModule('../src/services/hash.js', () => ({
      computeCertHash: jest.fn(),
      computeFileHash,
      isValidHash
    }));

    // Import the router after mocking
    const { default: router } = await import('../src/routes/verify.js');
    verifyRouter = router;

    // Import error handler
    const { errorHandler } = await import('../src/middleware/errorHandler.js');

    // Create test app
    app = express();
    app.use(express.json());
    app.use('/api/verify', verifyRouter);
    app.use(errorHandler); // Add error handler middleware
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock contract service
    mockContractService = {
      verifyCertificate: jest.fn(),
    };

    getCachedContractService.mockResolvedValue(mockContractService);
    
    // Set up default hash validation
    isValidHash.mockReturnValue(true);
    
    // Set up default IPFS and hash behavior
    fetchFromIPFS.mockResolvedValue(Buffer.from('mock-pdf-content'));
    computeFileHash.mockReturnValue('mock-computed-hash');
  });

  const validCertId = 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456';

  describe('Successful verification', () => {
    test('should verify valid certificate', async () => {
      const mockCertificate = {
        status: 'VALID',
        certificate: {
          certHash: 'mock-computed-hash', // This should match the computed hash
          studentName: 'John Doe',
          admissionNo: 'ADM001',
          programme: 'Computer Science',
          year: 2023,
          grade: 'First Class',
          ipfsCid: 'QmTestCID123456789',  // Use camelCase as expected by verify route
          issuedBy: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
          issuedAt: 12345,
          revoked: false
        }
      };

      mockContractService.verifyCertificate.mockResolvedValue(mockCertificate);

      const response = await request(app)
        .get(`/api/verify/${validCertId}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'VALID',
        hashVerified: true
      });

      expect(mockContractService.verifyCertificate).toHaveBeenCalledWith(validCertId);
      expect(fetchFromIPFS).toHaveBeenCalledWith('QmTestCID123456789');
      expect(computeFileHash).toHaveBeenCalled();
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
        .get(`/api/verify/${validCertId}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'REVOKED',
        certificate: expect.objectContaining({
          revoked: true
        }),
        message: 'Certificate has been revoked'
      });
    });

    test('should handle certificate not found', async () => {
      const mockNotFound = {
        status: 'NOT_FOUND',
        certificate: null
      };

      mockContractService.verifyCertificate.mockResolvedValue(mockNotFound);

      const response = await request(app)
        .get(`/api/verify/${validCertId}`);

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        status: 'NOT_FOUND',
        message: 'Certificate not found'
      });
    });
  });

  describe('Validation errors', () => {
    test('should return 400 if certId is missing', async () => {
      // For GET route, missing certId means hitting the base route
      const response = await request(app)
        .get('/api/verify/');

      expect(response.status).toBe(400); // Missing certificate ID
      expect(response.body.code).toBe('MISSING_CERT_ID');
    });

    test('should return 400 if certId is empty', async () => {
      // Empty certId in URL parameter (spaces are handled by base route)
      const response = await request(app)
        .get('/api/verify/   ');

      expect(response.status).toBe(400); // Missing certificate ID from base route
      expect(response.body.code).toBe('MISSING_CERT_ID');
    });

    test('should return 400 if certId format is invalid', async () => {
      isValidHash.mockReturnValue(false); // Mock invalid hash

      const response = await request(app)
        .get('/api/verify/invalid-cert-id');

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Invalid certificate ID format',
        code: 'INVALID_CERT_ID'
      });
    });

    test('should validate certId length (64 characters)', async () => {
      const shortCertId = 'a1b2c3d4e5f6';
      isValidHash.mockReturnValue(false); // Mock invalid hash

      const response = await request(app)
        .get(`/api/verify/${shortCertId}`);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Invalid certificate ID format',
        code: 'INVALID_CERT_ID'
      });
    });
  });

  describe('Service failures', () => {
    test('should handle blockchain service failure', async () => {
      mockContractService.verifyCertificate.mockRejectedValue(new Error('blockchain connection failed'));

      const response = await request(app)
        .get(`/api/verify/${validCertId}`);

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        error: 'Blockchain service unavailable',
        code: 'BLOCKCHAIN_ERROR'
      });
    });

    test('should handle contract call timeout', async () => {
      mockContractService.verifyCertificate.mockRejectedValue(new Error('contract call timeout'));

      const response = await request(app)
        .get(`/api/verify/${validCertId}`);

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        error: 'Blockchain service unavailable',
        code: 'BLOCKCHAIN_ERROR'
      });
    });
  });
});