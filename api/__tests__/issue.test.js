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
const mockConfig = { network: 'test' };

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

    // Import the router after mocking
    const { default: router } = await import('../src/routes/issue.js');
    issueRouter = router;

    // Import error handler
    const { errorHandler } = await import('../src/middleware/errorHandler.js');

    // Create test app
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true })); // Add form parsing
    app.use('/api/issue', issueRouter);
    app.use(errorHandler); // Add error handler middleware
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create fresh mock service
    mockContractService = {
      proposeCertificate: jest.fn(),
      approveCertificate: jest.fn(),
      getKeyByRole: jest.fn(),
    };

    // Make the factory return the mock service
    getCachedContractService.mockResolvedValue(mockContractService);

    // Reset upload middleware mock to properly handle multipart form data
    mockUpload.single.mockReturnValue(mockSingleMiddleware);
    mockSingleMiddleware.mockImplementation((req, res, next) => {
      // Set file for successful upload scenarios  
      req.file = { buffer: Buffer.from('mock-pdf-content'), mimetype: 'application/pdf' };
      next();
    });

    // Set default happy-path behaviour
    computeCertHash.mockReturnValue('test-cert-hash-123456789012345678901234567890123456789012345678');
    uploadToIPFS.mockResolvedValue({ cid: 'QmTestCID123456789' });
    pinCID.mockResolvedValue(true);
    mockContractService.proposeCertificate.mockResolvedValue('propose-tx-id');
    mockContractService.approveCertificate.mockResolvedValue('approve-tx-id');
    mockContractService.getKeyByRole.mockReturnValue('test-private-key');
  });

  const validCertificateData = {
    studentName: 'John Doe',
    admissionNo: 'ADM001',
    programme: 'Computer Science',
    year: '2023',
    grade: 'First Class'
  };

  // Create a test PDF buffer
  const testPdfBuffer = Buffer.from('mock-pdf-content');

  describe('Successful certificate issuance', () => {
    test('should issue certificate with valid data and PDF', async () => {
      // Override middleware to properly set req.body for successful test
      mockSingleMiddleware.mockImplementationOnce((req, res, next) => {
        req.file = { buffer: Buffer.from('mock-pdf-content'), mimetype: 'application/pdf' };
        req.body = {
          studentName: validCertificateData.studentName,
          admissionNo: validCertificateData.admissionNo,
          programme: validCertificateData.programme,
          year: validCertificateData.year,
          grade: validCertificateData.grade
        };
        next();
      });

      const response = await request(app)
        .post('/api/issue')
        .field('studentName', validCertificateData.studentName)
        .field('admissionNo', validCertificateData.admissionNo)
        .field('programme', validCertificateData.programme)
        .field('year', validCertificateData.year)
        .field('grade', validCertificateData.grade)
        .attach('pdf', testPdfBuffer, 'test-certificate.pdf');

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        certId: expect.any(String),
        ipfsCid: 'QmTestCID123456789',
        proposeTxId: 'propose-tx-id',
        approveTxId: 'approve-tx-id',
        status: 'issued',
        message: 'Certificate issued successfully'
      });

      // Verify service calls - computeCertHash is called twice
      expect(computeCertHash).toHaveBeenCalledTimes(2);
      expect(computeCertHash).toHaveBeenCalledWith(expect.objectContaining({
        studentName: 'John Doe',
        admissionNo: 'ADM001',
        programme: 'Computer Science',
        year: 2023,
        grade: 'First Class'
      }));
      expect(uploadToIPFS).toHaveBeenCalledWith(testPdfBuffer);
      expect(mockContractService.proposeCertificate).toHaveBeenCalled();
      expect(mockContractService.approveCertificate).toHaveBeenCalled();
      expect(pinCID).toHaveBeenCalledWith('QmTestCID123456789');
    });
  });

  describe('Validation errors', () => {
    test('should return 400 if PDF file is missing', async () => {
      // Override the middleware to simulate no file
      mockSingleMiddleware.mockImplementationOnce((req, res, next) => {
        req.file = null; // Simulate no file uploaded
        next();
      });

      const response = await request(app)
        .post('/api/issue')
        .field('studentName', validCertificateData.studentName)
        .field('admissionNo', validCertificateData.admissionNo)
        .field('programme', validCertificateData.programme)
        .field('year', validCertificateData.year)
        .field('grade', validCertificateData.grade);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'PDF file is required',
        code: 'MISSING_FILE'
      });
    });

    test('should return 400 if required field is missing', async () => {
      // Override middleware to not add studentName to req.body
      mockSingleMiddleware.mockImplementationOnce((req, res, next) => {
        req.file = { buffer: Buffer.from('mock-pdf-content'), mimetype: 'application/pdf' };
        // Don't populate req.body with studentName - simulate missing field
        req.body = {
          admissionNo: validCertificateData.admissionNo,
          programme: validCertificateData.programme,
          year: validCertificateData.year,
          grade: validCertificateData.grade
        };
        next();
      });

      const response = await request(app)
        .post('/api/issue')
        .field('admissionNo', validCertificateData.admissionNo)
        .field('programme', validCertificateData.programme)
        .field('year', validCertificateData.year)
        .field('grade', validCertificateData.grade)
        .attach('pdf', testPdfBuffer, 'test-certificate.pdf');

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Missing required field: studentName',
        code: 'MISSING_FIELD'
      });
    });

    test('should return 400 for invalid graduation year', async () => {
      // Override middleware to set invalid year in req.body
      mockSingleMiddleware.mockImplementationOnce((req, res, next) => {
        req.file = { buffer: Buffer.from('mock-pdf-content'), mimetype: 'application/pdf' };
        req.body = {
          studentName: validCertificateData.studentName,
          admissionNo: validCertificateData.admissionNo,
          programme: validCertificateData.programme,
          year: '1800',  // Invalid year
          grade: validCertificateData.grade
        };
        next();
      });

      const response = await request(app)
        .post('/api/issue')
        .field('studentName', validCertificateData.studentName)
        .field('admissionNo', validCertificateData.admissionNo)
        .field('programme', validCertificateData.programme)
        .field('year', '1800')  // Invalid year
        .field('grade', validCertificateData.grade)
        .attach('pdf', testPdfBuffer, 'test-certificate.pdf');

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Invalid graduation year',
        code: 'INVALID_YEAR'
      });
    });

    test('should return 400 for empty required fields', async () => {
      // Override middleware to set empty studentName in req.body
      mockSingleMiddleware.mockImplementationOnce((req, res, next) => {
        req.file = { buffer: Buffer.from('mock-pdf-content'), mimetype: 'application/pdf' };
        req.body = {
          studentName: '   ',  // Empty after trim
          admissionNo: validCertificateData.admissionNo,
          programme: validCertificateData.programme,
          year: validCertificateData.year,
          grade: validCertificateData.grade
        };
        next();
      });

      const response = await request(app)
        .post('/api/issue')
        .field('studentName', '   ')  // Empty after trim
        .field('admissionNo', validCertificateData.admissionNo)
        .field('programme', validCertificateData.programme)
        .field('year', validCertificateData.year)
        .field('grade', validCertificateData.grade)
        .attach('pdf', testPdfBuffer, 'test-certificate.pdf');

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Missing required field: studentName',
        code: 'MISSING_FIELD'
      });
    });
  });

  describe('Service failures', () => {
    test('should handle IPFS service failure', async () => {
      uploadToIPFS.mockRejectedValue(new Error('IPFS connection failed'));
      
      // Override middleware to properly set req.body
      mockSingleMiddleware.mockImplementationOnce((req, res, next) => {
        req.file = { buffer: Buffer.from('mock-pdf-content'), mimetype: 'application/pdf' };
        req.body = {
          studentName: validCertificateData.studentName,
          admissionNo: validCertificateData.admissionNo,
          programme: validCertificateData.programme,
          year: validCertificateData.year,
          grade: validCertificateData.grade
        };
        next();
      });

      const response = await request(app)
        .post('/api/issue')
        .field('studentName', validCertificateData.studentName)
        .field('admissionNo', validCertificateData.admissionNo)
        .field('programme', validCertificateData.programme)
        .field('year', validCertificateData.year)
        .field('grade', validCertificateData.grade)
        .attach('pdf', testPdfBuffer, 'test-certificate.pdf');

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        error: 'IPFS service unavailable',
        code: 'IPFS_ERROR'
      });
    });

    test('should handle blockchain service failure', async () => {
      mockContractService.proposeCertificate.mockRejectedValue(new Error('Blockchain contract call failed'));
      
      // Override middleware to properly set req.body
      mockSingleMiddleware.mockImplementationOnce((req, res, next) => {
        req.file = { buffer: Buffer.from('mock-pdf-content'), mimetype: 'application/pdf' };
        req.body = {
          studentName: validCertificateData.studentName,
          admissionNo: validCertificateData.admissionNo,
          programme: validCertificateData.programme,
          year: validCertificateData.year,
          grade: validCertificateData.grade
        };
        next();
      });

      const response = await request(app)
        .post('/api/issue')
        .field('studentName', validCertificateData.studentName)
        .field('admissionNo', validCertificateData.admissionNo)
        .field('programme', validCertificateData.programme)
        .field('year', validCertificateData.year)
        .field('grade', validCertificateData.grade)
        .attach('pdf', testPdfBuffer, 'test-certificate.pdf');

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        error: 'Blockchain service unavailable',
        code: 'BLOCKCHAIN_ERROR'
      });
    });

    test('should handle duplicate certificate', async () => {
      mockContractService.proposeCertificate.mockRejectedValue(new Error('Certificate already exists'));
      
      // Override middleware to properly set req.body
      mockSingleMiddleware.mockImplementationOnce((req, res, next) => {
        req.file = { buffer: Buffer.from('mock-pdf-content'), mimetype: 'application/pdf' };
        req.body = {
          studentName: validCertificateData.studentName,
          admissionNo: validCertificateData.admissionNo,
          programme: validCertificateData.programme,
          year: validCertificateData.year,
          grade: validCertificateData.grade
        };
        next();
      });

      const response = await request(app)
        .post('/api/issue')
        .field('studentName', validCertificateData.studentName)
        .field('admissionNo', validCertificateData.admissionNo)
        .field('programme', validCertificateData.programme)
        .field('year', validCertificateData.year)
        .field('grade', validCertificateData.grade)
        .attach('pdf', testPdfBuffer, 'test-certificate.pdf');

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        error: 'Certificate with this ID already exists',
        code: 'DUPLICATE_CERT'
      });
    });
  });
});