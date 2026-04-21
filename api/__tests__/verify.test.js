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

    await jest.unstable_mockModule('../src/middleware/errorHandler.js', () => ({
      createError: jest.fn((status, message, code) => {
        const error = new Error(message);
        error.statusCode = status;
        error.code = code;
        return error;
      }),
      errorHandler: jest.fn((err, req, res, next) => {
        res.status(err.statusCode || 500).json({
          error: err.message,
          code: err.code
        });
      })
    }));

    // Import the compiled router from dist directory
    const { default: router } = await import('../dist/routes/verify.js');
    verifyRouter = router;

    // Create mock error handler
    const mockErrorHandler = (err, req, res, next) => {
      res.status(err.statusCode || 500).json({
        error: err.message,
        code: err.code,
        message: err.message
      });
    };

    // Create test app
    app = express();
    app.use('/api/verify', verifyRouter);
    app.use(mockErrorHandler);
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock contract service
    mockContractService = {
      verifyCertificate: jest.fn()
    };

    // Setup default mock implementations - IMPORTANT: Default isValidHash to true
    getCachedContractService.mockResolvedValue(mockContractService);
    isValidHash.mockReturnValue(true);
  });

  test('should verify valid certificate successfully', async () => {
    const mockCertificate = {
      studentName: 'John Doe',
      programme: 'Computer Science',
      year: 2024,
      grade: 'A',
      ipfsCid: 'mock-ipfs-cid',
      certHash: 'mock-cert-hash'
    };

    mockContractService.verifyCertificate.mockResolvedValue({
      status: 'VALID',
      certificate: mockCertificate
    });

    fetchFromIPFS.mockResolvedValue(Buffer.from('mock-pdf-content'));
    computeFileHash.mockReturnValue('mock-cert-hash');

    const response = await request(app)
      .get('/api/verify/mock-cert-id-12345');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'VALID',
      certificate: mockCertificate,
      hashVerified: true,
      message: 'Certificate is valid and authentic'
    });

    expect(mockContractService.verifyCertificate).toHaveBeenCalledWith('mock-cert-id-12345');
    expect(fetchFromIPFS).toHaveBeenCalledWith('mock-ipfs-cid');
    expect(computeFileHash).toHaveBeenCalled();
  });

  test('should handle revoked certificate', async () => {
    const mockCertificate = {
      studentName: 'John Doe',
      programme: 'Computer Science',
      year: 2024,
      grade: 'A',
      ipfsCid: 'mock-ipfs-cid',
      certHash: 'mock-cert-hash'
    };

    mockContractService.verifyCertificate.mockResolvedValue({
      status: 'REVOKED',
      certificate: mockCertificate
    });

    const response = await request(app)
      .get('/api/verify/mock-cert-id-12345');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'REVOKED',
      certificate: {
        ...mockCertificate,
        ipfsCid: ''
      },
      message: 'Certificate has been revoked'
    });

    expect(mockContractService.verifyCertificate).toHaveBeenCalledWith('mock-cert-id-12345');
    expect(fetchFromIPFS).not.toHaveBeenCalled();
  });

  test('should handle certificate not found', async () => {
    mockContractService.verifyCertificate.mockResolvedValue({
      status: 'NOT_FOUND'
    });

    const response = await request(app)
      .get('/api/verify/mock-cert-id-12345');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      status: 'NOT_FOUND',
      message: 'Certificate not found'
    });

    expect(mockContractService.verifyCertificate).toHaveBeenCalledWith('mock-cert-id-12345');
    expect(fetchFromIPFS).not.toHaveBeenCalled();
  });

  test('should handle tampered certificate', async () => {
    const mockCertificate = {
      studentName: 'John Doe',
      programme: 'Computer Science',
      year: 2024,
      grade: 'A',
      ipfsCid: 'mock-ipfs-cid',
      certHash: 'mock-cert-hash'
    };

    mockContractService.verifyCertificate.mockResolvedValue({
      status: 'VALID',
      certificate: mockCertificate
    });

    fetchFromIPFS.mockResolvedValue(Buffer.from('mock-pdf-content'));
    computeFileHash.mockReturnValue('different-hash'); // Different hash to simulate tampering

    const response = await request(app)
      .get('/api/verify/mock-cert-id-12345');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'TAMPERED',
      certificate: mockCertificate,
      hashVerified: false,
      message: 'Certificate data may have been tampered with'
    });

    expect(mockContractService.verifyCertificate).toHaveBeenCalledWith('mock-cert-id-12345');
    expect(fetchFromIPFS).toHaveBeenCalledWith('mock-ipfs-cid');
    expect(computeFileHash).toHaveBeenCalled();
  });

  test('should handle IPFS fetch error', async () => {
    const mockCertificate = {
      studentName: 'John Doe',
      programme: 'Computer Science',
      year: 2024,
      grade: 'A',
      ipfsCid: 'mock-ipfs-cid',
      certHash: 'mock-cert-hash'
    };

    mockContractService.verifyCertificate.mockResolvedValue({
      status: 'VALID',
      certificate: mockCertificate
    });

    fetchFromIPFS.mockRejectedValue(new Error('IPFS connection failed'));

    const response = await request(app)
      .get('/api/verify/mock-cert-id-12345');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'VALID',
      certificate: {
        ...mockCertificate,
        ipfsCid: ''
      },
      hashVerified: false,
      message: 'Certificate is valid but PDF could not be retrieved for verification',
      warning: 'PDF verification failed - IPFS content may be unavailable'
    });

    expect(mockContractService.verifyCertificate).toHaveBeenCalledWith('mock-cert-id-12345');
    expect(fetchFromIPFS).toHaveBeenCalledWith('mock-ipfs-cid');
  });

  test('should handle invalid certificate ID format', async () => {
    // Override the default mock for this specific test
    isValidHash.mockReturnValueOnce(false);

    const response = await request(app)
      .get('/api/verify/invalid-cert-id');

    expect(response.status).toBe(400);
    expect(response.body.message || response.body.error).toContain('Invalid certificate ID format');

    expect(mockContractService.verifyCertificate).not.toHaveBeenCalled();
  });

  test('should handle missing certificate ID', async () => {
    const response = await request(app)
      .get('/api/verify/');

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Certificate ID is required');

    expect(mockContractService.verifyCertificate).not.toHaveBeenCalled();
  });

  test('should handle blockchain service error', async () => {
    mockContractService.verifyCertificate.mockRejectedValue(new Error('Blockchain service error'));

    const response = await request(app)
      .get('/api/verify/mock-cert-id-12345');

    expect(response.status).toBe(503);
    expect(response.body.message || response.body.error).toContain('Blockchain service unavailable');

    expect(mockContractService.verifyCertificate).toHaveBeenCalledWith('mock-cert-id-12345');
  });
});