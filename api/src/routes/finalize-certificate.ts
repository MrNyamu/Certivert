/**
 * Certificate Finalization Route Handler
 * POST /api/finalize-certificate - Finalizes certificate after blockchain transaction
 */

import { Router, type Response, type NextFunction, type Request } from 'express';
// @ts-ignore - JS imports in mixed project  
import { computeCertHash } from '../services/hash.js';
// @ts-ignore - JS imports in mixed project
import { pinCID } from '../services/ipfs.js';
// @ts-ignore - JS imports in mixed project
import { config } from '../config.js';
// @ts-ignore - JS imports in mixed project
import { createError } from '../middleware/errorHandler.js';
import { authenticateWallet, requireUniversityRole, type WalletAuthenticatedRequest } from '../middleware/auth.js';
// @ts-ignore - JS imports in mixed project
import { getCachedContractService } from '../services/contractFactory.js';

// Type imports
import type { 
  RouteHandler 
} from '../types/api.js';
import type { 
  CertificateData
} from '../types/certificate.js';

// Create router instance
const router = Router();

// Interface for request body
interface FinalizeCertificateRequestBody {
  txId: string;
  certId: string;
  ipfsCid: string;
  studentName: string;
  admissionNo: string;
  programme: string;
  year: string | number;
  grade: string;
}

/**
 * POST /api/finalize-certificate
 * Finalizes certificate after successful blockchain transaction
 * 
 * Request: JSON or form data
 * - txId (string): Blockchain transaction ID
 * - certId (string): Certificate ID hash
 * - ipfsCid (string): IPFS CID of pre-uploaded certificate
 * - studentName (string): Student's full name
 * - admissionNo (string): Admission number
 * - programme (string): Academic programme
 * - year (number): Graduation year
 * - grade (string): Grade achieved
 */
const finalizeCertificate = async (req: Request & WalletAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    console.log('🔄 Starting certificate finalization process...');
    
    // Step 1: Extract and validate required fields
    const { txId, certId, ipfsCid, studentName, admissionNo, programme, year, grade }: FinalizeCertificateRequestBody = req.body;
    
    const requiredFields = { txId, certId, ipfsCid, studentName, admissionNo, programme, year, grade };
    for (const [field, value] of Object.entries(requiredFields)) {
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        throw createError(400, `Missing required field: ${field}`, 'MISSING_FIELD');
      }
    }
    
    // Validate transaction ID format
    if (!txId.match(/^0x[a-fA-F0-9]{64}$/)) {
      throw createError(400, 'Invalid transaction ID format', 'INVALID_TRANSACTION_ID');
    }
    
    // Validate certificate ID format
    if (!certId || certId.length < 8) {
      throw createError(400, 'Certificate ID must be at least 8 characters', 'INVALID_CERT_ID');
    }
    
    // Validate and parse year
    const graduationYear = typeof year === 'string' ? parseInt(year, 10) : year as number;
    if (isNaN(graduationYear) || graduationYear < 1900 || graduationYear > new Date().getFullYear() + 10) {
      throw createError(400, 'Invalid graduation year', 'INVALID_YEAR');
    }
    
    // Step 3: Verify blockchain transaction exists and succeeded
    console.log(`🔍 Verifying blockchain transaction: ${txId}`);
    try {
      const response = await fetch(`${config.STACKS_API_URL}/extended/v1/tx/${txId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw createError(404, 'Blockchain transaction not found. Please wait for confirmation and try again.', 'TRANSACTION_NOT_FOUND');
        }
        throw createError(500, 'Failed to verify blockchain transaction', 'TRANSACTION_VERIFICATION_FAILED');
      }
      
      const txData = await response.json();
      
      // Check if transaction succeeded
      if (txData.tx_status !== 'success') {
        if (txData.tx_status === 'pending') {
          throw createError(400, 'Transaction is still pending. Please wait for confirmation.', 'TRANSACTION_PENDING');
        } else if (txData.tx_status === 'abort_by_response' || txData.tx_status === 'abort_by_post_condition') {
          throw createError(400, 'Blockchain transaction failed. The certificate may already exist or contract validation failed.', 'TRANSACTION_FAILED');
        } else {
          throw createError(400, `Transaction failed with status: ${txData.tx_status}`, 'TRANSACTION_FAILED');
        }
      }
      
      console.log(`✅ Transaction verified successfully: ${txId}`);
    } catch (fetchError: any) {
      if (fetchError.code) {
        throw fetchError; // Re-throw our custom errors
      }
      console.error('Transaction verification error:', fetchError);
      throw createError(500, 'Unable to verify blockchain transaction. Please try again.', 'VERIFICATION_ERROR');
    }
    
    // Step 4: Check for duplicate certificates
    console.log(`🔍 Checking for duplicate certificate: ${certId}`);
    try {
      const contractService = await getCachedContractService();
      const existingCert = await contractService.verifyCertificate(certId);
      
      if (existingCert && existingCert.status === 'VALID') {
        throw createError(409, 'Certificate already exists on the blockchain', 'DUPLICATE_CERTIFICATE');
      }
    } catch (verifyError: any) {
      // If verification fails due to cert not found, that's good (not a duplicate)
      if (verifyError.code !== 'DUPLICATE_CERTIFICATE' && !verifyError.message.includes('not found')) {
        console.warn('Certificate verification check failed, proceeding:', verifyError.message);
      }
    }
    
    // Step 5: Validate IPFS CID format
    if (!ipfsCid || ipfsCid.length < 8) {
      throw createError(400, 'Invalid IPFS CID format', 'INVALID_IPFS_CID');
    }
    
    // Step 6: Prepare certificate data
    const certData: CertificateData = {
      studentName: (studentName as string).trim(),
      admissionNo: (admissionNo as string).trim(),
      programme: (programme as string).trim(),
      year: graduationYear,
      grade: (grade as string).trim(),
      certHash: certId as string // Use provided certId as hash
    };
    
    console.log('📁 Processing certificate for:', certData.studentName);
    
    // Step 7: Pin the existing IPFS content
    console.log(`📌 Pinning existing IPFS content: ${ipfsCid}...`);
    try {
      await pinCID(ipfsCid);
      console.log(`✅ Content pinned: ${ipfsCid}`);
    } catch (pinError: any) {
      console.error('IPFS pinning error:', pinError);
      // Don't fail the request for pinning errors, just warn
      console.warn('⚠️ Failed to pin content, but finalization can proceed');
    }
    
    // Step 8: Return success response
    const response = {
      success: true,
      certId,
      ipfsCid,
      blockchainTxId: txId,
      status: 'finalized',
      message: 'Certificate finalized successfully',
      timestamp: new Date().toISOString(),
      network: config.STACKS_NETWORK,
      certificate: certData
    };
    
    console.log('🎉 Certificate finalization completed:', {
      certId,
      ipfsCid,
      txId,
      student: certData.studentName
    });
    
    res.status(201).json(response);
    
  } catch (error) {
    console.error('❌ Certificate finalization error:', {
      message: (error as Error).message,
      stack: (error as Error).stack,
      url: req.url,
      method: req.method,
      timestamp: new Date().toISOString()
    });
    next(error);
  }
};

// Register the route handler  
router.post('/', authenticateWallet, requireUniversityRole, finalizeCertificate);

export default router;