/**
 * Certificate Revocation Route Handler
 * POST /api/revoke - Revokes a certificate by ID and caller role
 */

import { Router } from 'express';
// @ts-ignore - JS imports in mixed project
import { getCachedContractService } from '../services/contractFactory.js';
// @ts-ignore - JS imports in mixed project
import { isValidHash } from '../services/hash.js';
// @ts-ignore - JS imports in mixed project
import { createError } from '../middleware/errorHandler.js';
import { authenticateWallet, requireRevocationRole, requireSigningCapability, type WalletAuthenticatedRequest } from '../middleware/auth.js';

// Type imports
import type { Request, Response, NextFunction } from 'express';
import type { ApiResponse, RouteHandler } from '../types/api.js';
import type { 
  UserRoleString, 
  ContractCertificate, 
  VerificationResult 
} from '../types/certificate.js';

const router = Router();

/**
 * Type definition for revoke certificate request body
 */
interface RevokeCertificateRequestBody {
  certId: string;
  callerRole: UserRoleString;
  reason?: string; // Optional field for future use
}

/**
 * Type definition for revoke certificate response
 */
interface RevokeCertificateResponse extends ApiResponse {
  certId: string;
  txId: string;
  status: 'revoked';
  revokedBy: UserRoleString;
  message: string;
}

/**
 * Type guard to validate caller role
 */
const isValidCallerRole = (role: any): role is UserRoleString => {
  return typeof role === 'string' && ['university', 'knqa'].includes(role);
};

/**
 * Type guard to validate revocation request
 */
const isValidRevocationRequest = (data: any): data is RevokeCertificateRequestBody => {
  return (
    data &&
    typeof data === 'object' &&
    typeof data.certId === 'string' &&
    data.certId.length > 0 &&
    isValidCallerRole(data.callerRole)
  );
};

/**
 * POST /api/revoke
 * Revokes a certificate
 * 
 * Request body:
 * - certId (string): Certificate ID to revoke
 * - callerRole (string): Role of caller ('university' or 'knqa')
 * - reason (string, optional): Reason for revocation
 * 
 * Note: In Phase 2, this will be replaced with wallet signature verification.
 * For Phase 1 prototype, we accept callerRole and use corresponding devnet private key.
 * 
 * @param req - Express request with revocation data
 * @param res - Express response
 * @param next - Express next function
 * @returns Promise<void>
 */
const revokeCertificate = async (req: Request & WalletAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const requestBody = req.body as RevokeCertificateRequestBody;
    
    // Validate request body structure
    if (!isValidRevocationRequest(requestBody)) {
      throw createError(400, 'Invalid request body format', 'INVALID_REQUEST');
    }
    
    const { certId, callerRole, reason } = requestBody;
    
    // Validate required fields
    if (!certId || !callerRole) {
      throw createError(400, 'Missing required fields: certId and callerRole', 'MISSING_FIELDS');
    }
    
    // Validate certificate ID format
    if (!isValidHash(certId)) {
      throw createError(400, 'Invalid certificate ID format', 'INVALID_CERT_ID');
    }
    
    // Validate caller role
    if (!isValidCallerRole(callerRole)) {
      throw createError(400, 'Invalid caller role. Must be "university" or "knqa"', 'INVALID_ROLE');
    }
    
    console.log(`Revoking certificate: ${certId} by role: ${callerRole}`);
    
    // Step 1: Get contract service
    const contractService = await getCachedContractService();
    
    // Step 2: Check if certificate exists and is not already revoked
    const { status, certificate }: VerificationResult = await contractService.verifyCertificate(certId);
    
    if (status === 'NOT_FOUND') {
      throw createError(404, 'Certificate not found', 'CERT_NOT_FOUND');
    }
    
    if (status === 'REVOKED') {
      throw createError(409, 'Certificate is already revoked', 'ALREADY_REVOKED');
    }
    
    // Step 3: Get identifier for the caller role (key for network, role for simnet)
    // TODO: Replace with wallet signature verification in Phase 2
    let callerKey: string;
    try {
      callerKey = contractService.getKeyByRole(callerRole);
    } catch (error) {
      throw createError(400, (error as Error).message, 'INVALID_ROLE');
    }
    
    // Step 4: Call contract to revoke the certificate
    console.log(`Calling contract to revoke certificate...`);
    const txId: string = await contractService.revokeCertificate(certId, callerKey);
    
    // Step 5: Return success response
    const response: RevokeCertificateResponse = {
      certId,
      txId,
      status: 'revoked',
      revokedBy: callerRole,
      message: 'Certificate revoked successfully'
    };
    
    console.log('Certificate revocation completed:', {
      certId,
      callerRole,
      txId,
      studentName: certificate?.studentName,
      reason: reason || 'No reason provided'
    });
    
    res.status(200).json(response);
    
  } catch (error) {
    // In test environment, use console.log to avoid red error output and exclude stack trace
    const logMethod = process.env.NODE_ENV === 'test' ? console.log : console.error;
    const logPrefix = process.env.NODE_ENV === 'test' ? '[TEST ERROR] Certificate revocation:' : 'Error in certificate revocation:';
    
    if (process.env.NODE_ENV === 'test') {
      logMethod(logPrefix, (error as Error).message);
    } else {
      logMethod(logPrefix, error);
    }
    
    // Handle specific error types
    if ((error as Error).message.includes('not authorized') || (error as Error).message.includes('ERR-NOT-AUTHORISED')) {
      return next(createError(403, 'Not authorized to revoke this certificate', 'NOT_AUTHORIZED'));
    }
    
    if ((error as Error).message.includes('already revoked') || (error as Error).message.includes('ERR-ALREADY-REVOKED')) {
      return next(createError(409, 'Certificate is already revoked', 'ALREADY_REVOKED'));
    }
    
    if ((error as Error).message.includes('contract') || (error as Error).message.includes('blockchain')) {
      return next(createError(503, 'Blockchain service unavailable', 'BLOCKCHAIN_ERROR'));
    }
    
    next(error);
  }
};

// Register route handlers
router.post('/', authenticateWallet, requireRevocationRole, requireSigningCapability, revokeCertificate);

export default router;