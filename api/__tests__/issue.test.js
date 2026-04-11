import request from 'supertest';
import express from 'express';
import path from 'path';
import fs from 'fs';
import issueRouter from '../src/routes/issue.js';

// Mock dependencies
jest.mock('../src/services/hash.js');
jest.mock('../src/services/ipfs.js');
jest.mock('../src/services/contractFactory.js');

import { computeCertHash } from '../src/services/hash.js';
import { uploadToIPFS, pinCID } from '../src/services/ipfs.js';
import { getCachedContractService } from '../src/services/contractFactory.js';

// Create test app
const app = express();
app.use(express.json());
app.use('/api/issue', issueRouter);

// Mock implementations
const mockContractService = {
  proposeCertificate: jest.fn(),
  approveCertificate: jest.fn(),
  getKeyByRole: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  computeCertHash.mockReturnValue('test-cert-hash-123456789012345678901234567890123456789012345678');
  uploadToIPFS.mockResolvedValue({ cid: 'QmTestCID123456789' });
  pinCID.mockResolvedValue(true);
  getCachedContractService.mockResolvedValue(mockContractService);
  mockContractService.proposeCertificate.mockResolvedValue('propose-tx-id');
  mockContractService.approveCertificate.mockResolvedValue('approve-tx-id');
  mockContractService.getKeyByRole.mockReturnValue('test-private-key');
});

describe('POST /api/issue', () => {
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

      // Verify service calls
      expect(computeCertHash).toHaveBeenCalledWith({
        studentName: 'John Doe',
        admissionNo: 'ADM001',
        programme: 'Computer Science',
        year: 2023,
        grade: 'First Class'
      });
      expect(uploadToIPFS).toHaveBeenCalledWith(testPdfBuffer);
      expect(mockContractService.proposeCertificate).toHaveBeenCalled();
      expect(mockContractService.approveCertificate).toHaveBeenCalled();
      expect(pinCID).toHaveBeenCalledWith('QmTestCID123456789');
    });
  });

  describe('Validation errors', () => {
    test('should return 400 if PDF file is missing', async () => {
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