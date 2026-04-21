import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// Mock functions
const computeCertHash = jest.fn();
const uploadToIPFS = jest.fn();
const pinCID = jest.fn();
const getCachedContractService = jest.fn();
// Create proper middleware mocks
const mockSingleMiddleware = jest.fn((req, res, next) => {
  req.file = { buffer: Buffer.from('mock-pdf-content'), mimetype: 'application/pdf' };
  next();
});
const mockUpload = { single: jest.fn(() => mockSingleMiddleware) };
const handleUploadError = jest.fn((error, req, res, next) => next());
const mockConfig = { 
  STACKS_NETWORK: 'test',
  DEPLOYER_PRIVATE_KEY: 'test-key',
  SIGNER_2_PRIVATE_KEY: 'test-signer2-key'
};

describe('POST /api/issue', () => {
  let app;
  let issueRouter;
  let mockContractService;

  beforeAll(async () => {
    // Create mocks using unstable_mockModule with correct relative paths
    await jest.unstable_mockModule('../src/services/hash.js', () => ({
      computeCertHash,
      computeFileHash: jest.fn(),
      isValidHash: jest.fn()
    }));

    await jest.unstable_mockModule('../src/services/ipfs.js', () => ({
      uploadToIPFS,
      pinCID,
      fetchFromIPFS: jest.fn(),
      checkIPFSConnection: jest.fn(),
      closeIPFSClient: jest.fn()
    }));

    await jest.unstable_mockModule('../src/services/contractFactory.js', () => ({
      getCachedContractService
    }));

    await jest.unstable_mockModule('../src/middleware/upload.js', () => ({
      default: mockUpload,
      handleUploadError
    }));

    await jest.unstable_mockModule('../src/config.js', () => ({
      config: mockConfig
    }));

    await jest.unstable_mockModule('../src/middleware/errorHandler.js', () => ({
      createError: jest.fn((status, message, code) => {
        const error = new Error(message);
        error.statusCode = status;
        error.code = code;
        return error;
      })
    }));

    // Import the compiled router from dist directory
    const { default: router } = await import('../dist/routes/issue.js');
    issueRouter = router;

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
    app.use(express.json());
    app.use('/api/issue', issueRouter);
    app.use(mockErrorHandler);
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock contract service
    mockContractService = {
      proposeCertificate: jest.fn(),
      approveCertificate: jest.fn()
    };

    // Setup default mock implementations
    computeCertHash.mockReturnValue('mock-cert-hash-12345');
    uploadToIPFS.mockResolvedValue({ cid: 'mock-ipfs-cid-67890' });
    pinCID.mockResolvedValue();
    getCachedContractService.mockResolvedValue(mockContractService);
    mockContractService.proposeCertificate.mockResolvedValue('mock-propose-tx-id');
    mockContractService.approveCertificate.mockResolvedValue('mock-approve-tx-id');
  });

  test('should issue a certificate successfully', async () => {
    const response = await request(app)
      .post('/api/issue')
      .field('studentName', 'John Doe')
      .field('admissionNo', 'ADM001')
      .field('programme', 'Computer Science')
      .field('year', '2024')
      .field('grade', 'A')
      .attach('pdf', Buffer.from('mock-pdf-content'), 'certificate.pdf');

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      certId: 'mock-cert-hash-12345',
      ipfsCid: 'mock-ipfs-cid-67890',
      proposeTxId: 'mock-propose-tx-id',
      approveTxId: 'mock-approve-tx-id',
      status: 'issued',
      message: 'Certificate issued successfully'
    });

    // Verify all functions were called
    expect(computeCertHash).toHaveBeenCalledWith({
      studentName: 'John Doe',
      admissionNo: 'ADM001',
      programme: 'Computer Science',
      year: 2024,
      grade: 'A'
    });
    expect(uploadToIPFS).toHaveBeenCalled();
    expect(mockContractService.proposeCertificate).toHaveBeenCalled();
    expect(mockContractService.approveCertificate).toHaveBeenCalled();
    expect(pinCID).toHaveBeenCalledWith('mock-ipfs-cid-67890');
  });

  test('should fail when file is missing', async () => {
    // Mock file upload to return no file
    const mockSingleMiddlewareNoFile = jest.fn((req, res, next) => {
      req.file = undefined;
      next();
    });
    mockUpload.single.mockReturnValueOnce(mockSingleMiddlewareNoFile);

    const response = await request(app)
      .post('/api/issue')
      .field('studentName', 'John Doe')
      .field('admissionNo', 'ADM001')
      .field('programme', 'Computer Science')
      .field('year', '2024')
      .field('grade', 'A');

    expect(response.status).toBe(400);
    expect(response.body.message || response.body.error).toContain('PDF file is required');
  });

  test('should fail when required fields are missing', async () => {
    const response = await request(app)
      .post('/api/issue')
      .field('studentName', 'John Doe')
      .attach('pdf', Buffer.from('mock-pdf-content'), 'certificate.pdf');

    expect(response.status).toBe(400);
    expect(response.body.message || response.body.error).toContain('Missing required field');
  });

  test('should fail when year is invalid', async () => {
    const response = await request(app)
      .post('/api/issue')
      .field('studentName', 'John Doe')
      .field('admissionNo', 'ADM001')
      .field('programme', 'Computer Science')
      .field('year', 'invalid-year')
      .field('grade', 'A')
      .attach('pdf', Buffer.from('mock-pdf-content'), 'certificate.pdf');

    expect(response.status).toBe(400);
    expect(response.body.message || response.body.error).toContain('Invalid graduation year');
  });

  test('should handle IPFS upload error', async () => {
    uploadToIPFS.mockRejectedValue(new Error('IPFS connection failed'));

    const response = await request(app)
      .post('/api/issue')
      .field('studentName', 'John Doe')
      .field('admissionNo', 'ADM001')
      .field('programme', 'Computer Science')
      .field('year', '2024')
      .field('grade', 'A')
      .attach('pdf', Buffer.from('mock-pdf-content'), 'certificate.pdf');

    expect(response.status).toBe(503);
    expect(response.body.message || response.body.error).toContain('IPFS service unavailable');
  });

  test('should handle blockchain error', async () => {
    mockContractService.proposeCertificate.mockRejectedValue(new Error('Contract error'));

    const response = await request(app)
      .post('/api/issue')
      .field('studentName', 'John Doe')
      .field('admissionNo', 'ADM001')
      .field('programme', 'Computer Science')
      .field('year', '2024')
      .field('grade', 'A')
      .attach('pdf', Buffer.from('mock-pdf-content'), 'certificate.pdf');

    expect(response.status).toBe(503);
    expect(response.body.message || response.body.error).toContain('Blockchain service unavailable');
  });

  test('should handle duplicate certificate error', async () => {
    mockContractService.proposeCertificate.mockRejectedValue(new Error('Certificate already exists'));

    const response = await request(app)
      .post('/api/issue')
      .field('studentName', 'John Doe')
      .field('admissionNo', 'ADM001')
      .field('programme', 'Computer Science')
      .field('year', '2024')
      .field('grade', 'A')
      .attach('pdf', Buffer.from('mock-pdf-content'), 'certificate.pdf');

    expect(response.status).toBe(409);
    expect(response.body.message || response.body.error).toContain('Certificate with this ID already exists');
  });
});