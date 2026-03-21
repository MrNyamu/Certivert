import { Router } from 'express';
import { getCachedContractService } from '../services/contractFactory.js';
import { isValidHash } from '../services/hash.js';
import { createError } from '../middleware/errorHandler.js';

const router = Router();

/**
 * POST /api/revoke
 * Revokes a certificate
 * 
 * Request body:
 * - certId (string): Certificate ID to revoke
 * - callerRole (string): Role of caller ('university' or 'knqa')
 * 
 * Note: In Phase 2, this will be replaced with wallet signature verification.
 * For Phase 1 prototype, we accept callerRole and use corresponding devnet private key.
 */
router.post('/', async (req, res, next) => {
  try {
    const { certId, callerRole } = req.body;
    
    // Validate required fields
    if (!certId || !callerRole) {
      throw createError(400, 'Missing required fields: certId and callerRole', 'MISSING_FIELDS');
    }
    
    // Validate certificate ID format
    if (!isValidHash(certId)) {
      throw createError(400, 'Invalid certificate ID format', 'INVALID_CERT_ID');
    }
    
    // Validate caller role
    if (!['university', 'knqa'].includes(callerRole)) {
      throw createError(400, 'Invalid caller role. Must be "university" or "knqa"', 'INVALID_ROLE');
    }
    
    console.log(`Revoking certificate: ${certId} by role: ${callerRole}`);
    
    // Step 1: Get contract service
    const contractService = await getCachedContractService();
    
    // Step 2: Check if certificate exists and is not already revoked
    const { status, certificate } = await contractService.verifyCertificate(certId);
    
    if (status === 'NOT_FOUND') {
      throw createError(404, 'Certificate not found', 'CERT_NOT_FOUND');
    }
    
    if (status === 'REVOKED') {
      throw createError(409, 'Certificate is already revoked', 'ALREADY_REVOKED');
    }
    
    // Step 3: Get identifier for the caller role (key for network, role for simnet)
    // TODO: Replace with wallet signature verification in Phase 2
    let callerKey;
    try {
      callerKey = contractService.getKeyByRole(callerRole);
    } catch (error) {
      throw createError(400, error.message, 'INVALID_ROLE');
    }
    
    // Step 4: Call contract to revoke the certificate
    console.log(`Calling contract to revoke certificate...`);
    const txId = await contractService.revokeCertificate(certId, callerKey);
    
    // Step 5: Return success response
    const response = {
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
      studentName: certificate?.studentName
    });
    
    res.status(200).json(response);
    
  } catch (error) {
    console.error('Error in certificate revocation:', error);
    
    // Handle specific error types
    if (error.message.includes('not authorized') || error.message.includes('ERR-NOT-AUTHORISED')) {
      return next(createError(403, 'Not authorized to revoke this certificate', 'NOT_AUTHORIZED'));
    }
    
    if (error.message.includes('already revoked') || error.message.includes('ERR-ALREADY-REVOKED')) {
      return next(createError(409, 'Certificate is already revoked', 'ALREADY_REVOKED'));
    }
    
    if (error.message.includes('contract') || error.message.includes('blockchain')) {
      return next(createError(503, 'Blockchain service unavailable', 'BLOCKCHAIN_ERROR'));
    }
    
    next(error);
  }
});

export default router;