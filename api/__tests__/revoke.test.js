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

    await jest.unstable_mockModule('../src/middleware/errorHandler.js', () => ({
      createError: jest.fn((status, message, code) => {
        const error = new Error(message);
        error.statusCode = status;
        error.code = code;
        return error;
      })
    }));

    // Import the compiled router from dist directory
    const { default: router } = await import('../dist/routes/revoke.js');
    revokeRouter = router;

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
    app.use('/api/revoke', revokeRouter);
    app.use(mockErrorHandler);
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock contract service
    mockContractService = {
      verifyCertificate: jest.fn(),
      revokeCertificate: jest.fn(),
      getKeyByRole: jest.fn()
    };

    // Setup default mock implementations
    getCachedContractService.mockResolvedValue(mockContractService);
    isValidHash.mockReturnValue(true);
  });

  test('should revoke certificate successfully', async () => {
    const mockCertificate = {
      studentName: 'John Doe',
      programme: 'Computer Science',
      year: 2024,
      grade: 'A'
    };

    mockContractService.verifyCertificate.mockResolvedValue({
      status: 'VALID',
      certificate: mockCertificate
    });
    mockContractService.getKeyByRole.mockReturnValue('mock-private-key');
    mockContractService.revokeCertificate.mockResolvedValue('mock-tx-id');

    const response = await request(app)
      .post('/api/revoke')
      .send({
        certId: 'mock-cert-id-12345',
        callerRole: 'university',
        reason: 'Academic misconduct'
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      certId: 'mock-cert-id-12345',
      txId: 'mock-tx-id',
      status: 'revoked',
      revokedBy: 'university',
      message: 'Certificate revoked successfully'
    });

    expect(mockContractService.verifyCertificate).toHaveBeenCalledWith('mock-cert-id-12345');
    expect(mockContractService.getKeyByRole).toHaveBeenCalledWith('university');
    expect(mockContractService.revokeCertificate).toHaveBeenCalledWith('mock-cert-id-12345', 'mock-private-key');
  });

  test('should allow KNQA to revoke certificate', async () => {
    const mockCertificate = {
      studentName: 'Jane Doe',
      programme: 'Engineering',
      year: 2024,
      grade: 'B+'
    };

    mockContractService.verifyCertificate.mockResolvedValue({
      status: 'VALID',
      certificate: mockCertificate
    });
    mockContractService.getKeyByRole.mockReturnValue('mock-knqa-key');
    mockContractService.revokeCertificate.mockResolvedValue('mock-tx-id-knqa');

    const response = await request(app)
      .post('/api/revoke')
      .send({
        certId: 'mock-cert-id-67890',
        callerRole: 'knqa',
        reason: 'Verification failure'
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      certId: 'mock-cert-id-67890',
      txId: 'mock-tx-id-knqa',
      status: 'revoked',
      revokedBy: 'knqa',
      message: 'Certificate revoked successfully'
    });

    expect(mockContractService.getKeyByRole).toHaveBeenCalledWith('knqa');
  });

  test('should fail when required fields are missing', async () => {
    const response = await request(app)
      .post('/api/revoke')
      .send({
        certId: 'mock-cert-id-12345'
        // Missing callerRole
      });

    expect(response.status).toBe(400);
    expect(response.body.message || response.body.error).toContain('Missing required fields: certId and callerRole');

    expect(mockContractService.verifyCertificate).not.toHaveBeenCalled();
  });

  test('should fail when certificate ID format is invalid', async () => {
    isValidHash.mockReturnValue(false);

    const response = await request(app)
      .post('/api/revoke')
      .send({
        certId: 'invalid-cert-id',
        callerRole: 'university'
      });

    expect(response.status).toBe(400);
    expect(response.body.message || response.body.error).toContain('Invalid certificate ID format');

    expect(mockContractService.verifyCertificate).not.toHaveBeenCalled();
  });

  test('should fail when caller role is invalid', async () => {
    const response = await request(app)
      .post('/api/revoke')
      .send({
        certId: 'mock-cert-id-12345',
        callerRole: 'invalid-role'
      });

    expect(response.status).toBe(400);
    expect(response.body.message || response.body.error).toContain('Invalid caller role. Must be "university" or "knqa"');

    expect(mockContractService.verifyCertificate).not.toHaveBeenCalled();
  });

  test('should fail when certificate is not found', async () => {
    mockContractService.verifyCertificate.mockResolvedValue({
      status: 'NOT_FOUND'
    });

    const response = await request(app)
      .post('/api/revoke')
      .send({
        certId: 'nonexistent-cert-id',
        callerRole: 'university'
      });

    expect(response.status).toBe(404);
    expect(response.body.message || response.body.error).toContain('Certificate not found');

    expect(mockContractService.verifyCertificate).toHaveBeenCalledWith('nonexistent-cert-id');
    expect(mockContractService.revokeCertificate).not.toHaveBeenCalled();
  });

  test('should fail when certificate is already revoked', async () => {
    mockContractService.verifyCertificate.mockResolvedValue({
      status: 'REVOKED',
      certificate: { studentName: 'John Doe' }
    });

    const response = await request(app)
      .post('/api/revoke')
      .send({
        certId: 'mock-cert-id-12345',
        callerRole: 'university'
      });

    expect(response.status).toBe(409);
    expect(response.body.message || response.body.error).toContain('Certificate is already revoked');

    expect(mockContractService.verifyCertificate).toHaveBeenCalledWith('mock-cert-id-12345');
    expect(mockContractService.revokeCertificate).not.toHaveBeenCalled();
  });

  test('should handle authorization error from contract', async () => {
    const mockCertificate = {
      studentName: 'John Doe',
      programme: 'Computer Science'
    };

    mockContractService.verifyCertificate.mockResolvedValue({
      status: 'VALID',
      certificate: mockCertificate
    });
    mockContractService.getKeyByRole.mockReturnValue('mock-private-key');
    mockContractService.revokeCertificate.mockRejectedValue(new Error('ERR-NOT-AUTHORISED'));

    const response = await request(app)
      .post('/api/revoke')
      .send({
        certId: 'mock-cert-id-12345',
        callerRole: 'university'
      });

    expect(response.status).toBe(403);
    expect(response.body.message || response.body.error).toContain('Not authorized to revoke this certificate');
  });

  test('should handle blockchain service error', async () => {
    const mockCertificate = {
      studentName: 'John Doe',
      programme: 'Computer Science'
    };

    mockContractService.verifyCertificate.mockResolvedValue({
      status: 'VALID',
      certificate: mockCertificate
    });
    mockContractService.getKeyByRole.mockReturnValue('mock-private-key');
    mockContractService.revokeCertificate.mockRejectedValue(new Error('Blockchain connection failed'));

    const response = await request(app)
      .post('/api/revoke')
      .send({
        certId: 'mock-cert-id-12345',
        callerRole: 'university'
      });

    expect(response.status).toBe(503);
    expect(response.body.message || response.body.error).toContain('Blockchain service unavailable');
  });

  test('should handle invalid role from getKeyByRole', async () => {
    const mockCertificate = {
      studentName: 'John Doe',
      programme: 'Computer Science'
    };

    mockContractService.verifyCertificate.mockResolvedValue({
      status: 'VALID',
      certificate: mockCertificate
    });
    mockContractService.getKeyByRole.mockImplementation(() => {
      throw new Error('Invalid role for key lookup');
    });

    const response = await request(app)
      .post('/api/revoke')
      .send({
        certId: 'mock-cert-id-12345',
        callerRole: 'university'
      });

    expect(response.status).toBe(400);
    expect(response.body.message || response.body.error).toContain('Invalid role for key lookup');
  });
});