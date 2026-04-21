/**
 * Certificate Verification Route Handler
 * GET /api/verify/:certId - Verifies a certificate by ID
 */

import { Router } from 'express';
// @ts-ignore - JS imports in mixed project
import { getCachedContractService } from '../services/contractFactory.js';
// @ts-ignore - JS imports in mixed project
import { fetchFromIPFS } from '../services/ipfs.js';
// @ts-ignore - JS imports in mixed project
import { computeFileHash, isValidHash } from '../services/hash.js';
// @ts-ignore - JS imports in mixed project
import { createError } from '../middleware/errorHandler.js';

// Type imports
import type { Request, Response, NextFunction } from 'express';
import type { ApiResponse, RouteHandler } from '../types/api.js';
import type { 
  VerificationResult, 
  ContractCertificate 
} from '../types/certificate.js';

const router = Router();

/**
 * Type definition for certificate verification response
 */
interface VerificationResponse extends ApiResponse<ContractCertificate> {
  status: 'VALID' | 'REVOKED' | 'NOT_FOUND' | 'TAMPERED';
  certificate?: ContractCertificate | undefined;
  hashVerified?: boolean;
  message?: string;
  warning?: string;
}

/**
 * Type definition for certificate verification error response
 */
interface VerificationErrorResponse extends ApiResponse {
  error: string;
  code: string;
  message: string;
}

/**
 * GET /api/verify
 * Base route - returns 400 for missing certId
 * 
 * @param req - Express request
 * @param res - Express response
 * @returns void
 */
const verifyBase: RouteHandler = (req: Request, res: Response): void => {
  const errorResponse: VerificationErrorResponse = {
    error: 'Certificate ID is required',
    code: 'MISSING_CERT_ID',
    message: 'Please provide a certificate ID in the URL: /api/verify/{certId}'
  };
  
  res.status(400).json(errorResponse);
};

/**
 * GET /api/verify/:certId
 * Verifies a certificate by ID
 * 
 * Parameters:
 * - certId (string): Certificate ID (SHA-256 hash)
 * 
 * Returns:
 * - status: "VALID" | "REVOKED" | "NOT_FOUND" | "TAMPERED"
 * - certificate: Certificate object (if found)
 * - hashVerified: Boolean indicating if PDF hash matches (only for VALID/TAMPERED)
 * 
 * @param req - Express request with certId parameter
 * @param res - Express response
 * @param next - Express next function
 * @returns Promise<void>
 */
const verifyCertificate: RouteHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { certId } = req.params as { certId: string };
    
    // Validate certificate ID format
    if (!certId || !isValidHash(certId)) {
      throw createError(400, 'Invalid certificate ID format', 'INVALID_CERT_ID');
    }
    
    console.log(`Verifying certificate: ${certId}`);
    
    // Step 1: Get contract service and verify certificate status
    const contractService = await getCachedContractService();
    const { status, certificate }: VerificationResult = await contractService.verifyCertificate(certId);
    
    // Step 2: Handle NOT_FOUND case
    if (status === 'NOT_FOUND') {
      console.log(`Certificate not found: ${certId}`);
      const response: VerificationResponse = {
        status: 'NOT_FOUND',
        message: 'Certificate not found'
      };
      res.status(404).json(response);
      return;
    }
    
    // Step 3: Handle REVOKED case
    if (status === 'REVOKED') {
      console.log(`Certificate revoked: ${certId}`);
      
      // Create sanitized certificate for revoked certificates
      const sanitizedCertificate: ContractCertificate | undefined = certificate ? {
        ...certificate,
        // Remove sensitive data for revoked certificates
        ipfsCid: ''
      } : undefined;
      
      const response: VerificationResponse = {
        status: 'REVOKED',
        certificate: sanitizedCertificate,
        message: 'Certificate has been revoked'
      };
      res.status(200).json(response);
      return;
    }
    
    // Step 4: Handle VALID case - verify PDF hash integrity
    if (status === 'VALID' && certificate) {
      console.log(`Certificate found as valid, verifying PDF integrity...`);
      
      try {
        // Fetch encrypted PDF from IPFS
        const pdfBuffer: Buffer = await fetchFromIPFS(certificate.ipfsCid);
        
        // Compute hash of decrypted PDF
        const computedHash: string = computeFileHash(pdfBuffer);
        
        // Compare with stored hash in certificate
        const hashVerified: boolean = computedHash === certificate.certHash;
        
        if (hashVerified) {
          console.log(`Certificate verified successfully: ${certId}`);
          const response: VerificationResponse = {
            status: 'VALID',
            certificate,
            hashVerified: true,
            message: 'Certificate is valid and authentic'
          };
          res.status(200).json(response);
          return;
        } else {
          console.warn(`Hash mismatch detected for certificate: ${certId}`);
          console.warn(`Expected: ${certificate.certHash}, Computed: ${computedHash}`);
          
          const response: VerificationResponse = {
            status: 'TAMPERED',
            certificate,
            hashVerified: false,
            message: 'Certificate data may have been tampered with'
          };
          res.status(200).json(response);
          return;
        }
        
      } catch (ipfsError) {
        // In test environment, use console.log to avoid red error output and exclude stack trace
        const logMethod = process.env.NODE_ENV === 'test' ? console.log : console.error;
        const logPrefix = process.env.NODE_ENV === 'test' ? `[TEST ERROR] PDF fetch for certificate ${certId}:` : `Error fetching PDF for certificate ${certId}:`;
        
        if (process.env.NODE_ENV === 'test') {
          logMethod(logPrefix, (ipfsError as Error).message);
        } else {
          logMethod(logPrefix, ipfsError);
        }
        
        // Return certificate info but indicate PDF verification failed
        const sanitizedCertificate: ContractCertificate = {
          ...certificate,
          // Remove IPFS CID if we can't fetch the PDF
          ipfsCid: ''
        };
        
        const response: VerificationResponse = {
          status: 'VALID',
          certificate: sanitizedCertificate,
          hashVerified: false,
          message: 'Certificate is valid but PDF could not be retrieved for verification',
          warning: 'PDF verification failed - IPFS content may be unavailable'
        };
        res.status(200).json(response);
        return;
      }
    }
    
    // Step 5: Handle unknown status (should not happen)
    throw createError(500, `Unknown certificate status: ${status}`, 'UNKNOWN_STATUS');
    
  } catch (error) {
    // In test environment, use console.log to avoid red error output and exclude stack trace
    const logMethod = process.env.NODE_ENV === 'test' ? console.log : console.error;
    const logPrefix = process.env.NODE_ENV === 'test' ? '[TEST ERROR] Certificate verification:' : 'Error in certificate verification:';
    
    if (process.env.NODE_ENV === 'test') {
      logMethod(logPrefix, (error as Error).message);
    } else {
      logMethod(logPrefix, error);
    }
    
    // Handle specific error types
    if ((error as Error).message.includes('contract') || (error as Error).message.includes('blockchain')) {
      return next(createError(503, 'Blockchain service unavailable', 'BLOCKCHAIN_ERROR'));
    }
    
    if ((error as Error).message.includes('IPFS')) {
      return next(createError(503, 'IPFS service unavailable', 'IPFS_ERROR'));
    }
    
    next(error);
  }
};

// Register route handlers
router.get('/', verifyBase);
router.get('/:certId', verifyCertificate);

export default router;