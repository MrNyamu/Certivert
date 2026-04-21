/**
 * Certificate Issuance Route Handler
 * POST /api/issue - Issues a new certificate with PDF upload
 */

import { Router, type Response, type NextFunction } from 'express';
// @ts-ignore - JS imports in mixed project
import upload, { handleUploadError } from '../middleware/upload.js';
// @ts-ignore - JS imports in mixed project  
import { computeCertHash } from '../services/hash.js';
// @ts-ignore - JS imports in mixed project
import { uploadToIPFS, pinCID } from '../services/ipfs.js';
// @ts-ignore - JS imports in mixed project
import { getCachedContractService } from '../services/contractFactory.js';
// @ts-ignore - JS imports in mixed project
import { config } from '../config.js';
// @ts-ignore - JS imports in mixed project
import { createError } from '../middleware/errorHandler.js';
import { authenticateWallet, requireUniversityRole, requireSigningCapability, type WalletAuthenticatedRequest } from '../middleware/auth.js';

// Type imports
import type { 
  RequestWithFile, 
  RouteHandlerWithFile 
} from '../types/api.js';
import type { 
  CertificateData, 
  IssueCertificateRequest, 
  IssueCertificateResponse 
} from '../types/certificate.js';
import { isValidCertificateData } from '../types/index.js';

const router = Router();

/**
 * Type definition for issue certificate request body
 */
interface IssueCertificateRequestBody extends IssueCertificateRequest {
  [key: string]: any; // Allow for additional form fields
}

// Type guard imported from types/index.js

/**
 * POST /api/issue
 * Issues a new certificate
 * 
 * Request: multipart/form-data
 * - studentName (string): Student's full name
 * - admissionNo (string): Admission number
 * - programme (string): Academic programme
 * - year (number): Graduation year
 * - grade (string): Grade achieved
 * - pdf (file): Certificate PDF file (required, max 10MB)
 * 
 * @param req - Express request with file upload capabilities
 * @param res - Express response
 * @param next - Express next function
 * @returns Promise<void>
 */
const issueCertificate = async (req: RequestWithFile & WalletAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate file upload
    if (!req.file) {
      throw createError(400, 'PDF file is required', 'MISSING_FILE');
    }
    
    // Extract and validate required fields
    const { studentName, admissionNo, programme, year, grade }: IssueCertificateRequestBody = req.body;
    
    const requiredFields = { studentName, admissionNo, programme, year, grade };
    for (const [field, value] of Object.entries(requiredFields)) {
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        throw createError(400, `Missing required field: ${field}`, 'MISSING_FIELD');
      }
    }
    
    // Validate and parse year - handle both string and number inputs
    const graduationYear = typeof year === 'string' ? parseInt(year, 10) : year as number;
    if (isNaN(graduationYear) || graduationYear < 1900 || graduationYear > new Date().getFullYear() + 10) {
      throw createError(400, 'Invalid graduation year', 'INVALID_YEAR');
    }
    
    // Prepare certificate data
    const certData: CertificateData = {
      studentName: (studentName as string).trim(),
      admissionNo: (admissionNo as string).trim(),
      programme: (programme as string).trim(),
      year: graduationYear,
      grade: (grade as string).trim()
    };
    
    // Validate certificate data using type guard
    if (!isValidCertificateData(certData)) {
      throw createError(400, 'Invalid certificate data format', 'INVALID_DATA');
    }
    
    console.log('Processing certificate issuance:', certData);
    console.log('Connected wallet:', req.wallet);
    
    // Role verification is already handled by requireUniversityRole middleware
    // Additional verification can be added here if needed
    
    // Step 1: Compute certificate ID (SHA-256 hash of cert data)
    const certId: string = computeCertHash(certData);
    console.log(`Generated cert ID: ${certId}`);
    
    // Step 2: Upload encrypted PDF to IPFS
    console.log('Uploading PDF to IPFS...');
    const { cid }: { cid: string } = await uploadToIPFS(req.file.buffer);
    
    // Add cert hash to data (for contract storage)
    const certDataWithHash = { 
      ...certData, 
      certHash: computeCertHash(certData) // Same as certId, but explicit
    };
    
    // Step 3: Get contract service
    const contractService = await getCachedContractService();
    
    // Step 4: Propose certificate on blockchain
    console.log('Proposing certificate on blockchain...');
    const proposeTxId: string = await contractService.proposeCertificate(
      certId,
      certData,
      cid,
      config.STACKS_NETWORK === 'simnet' ? 'university' : config.DEPLOYER_PRIVATE_KEY
    );
    
    // Step 5: Auto-approve for prototype (2-of-2 multi-sig)
    // TODO: In production, this would be a separate action by Signer 2
    console.log('Auto-approving certificate (prototype mode)...');
    const approveTxId: string = await contractService.approveCertificate(
      certId,
      config.STACKS_NETWORK === 'simnet' ? 'signer2' : config.SIGNER_2_PRIVATE_KEY
    );
    
    // Step 6: Pin the CID on IPFS (after successful blockchain registration)
    console.log('Pinning content on IPFS...');
    await pinCID(cid);
    
    // Return success response
    const response: IssueCertificateResponse = {
      certId,
      ipfsCid: cid,
      proposeTxId,
      approveTxId,
      status: 'issued',
      message: 'Certificate issued successfully'
    };
    
    console.log('Certificate issuance completed:', {
      certId,
      studentName: certData.studentName,
      proposeTxId,
      approveTxId
    });
    
    res.status(201).json(response);
    
  } catch (error) {
    // In test environment, use console.log to avoid red error output and exclude stack trace
    const logMethod = process.env.NODE_ENV === 'test' ? console.log : console.error;
    const logPrefix = process.env.NODE_ENV === 'test' ? '[TEST ERROR] Certificate issuance:' : 'Error in certificate issuance:';
    
    if (process.env.NODE_ENV === 'test') {
      logMethod(logPrefix, (error as Error).message);
    } else {
      logMethod(logPrefix, error);
    }
    
    // Handle specific error types
    if ((error as Error).message.includes('already exists') || (error as Error).message.includes('already pending')) {
      return next(createError(409, 'Certificate with this ID already exists', 'DUPLICATE_CERT'));
    }
    
    if ((error as Error).message.includes('IPFS')) {
      return next(createError(503, 'IPFS service unavailable', 'IPFS_ERROR'));
    }
    
    if ((error as Error).message.includes('contract') || (error as Error).message.includes('blockchain')) {
      return next(createError(503, 'Blockchain service unavailable', 'BLOCKCHAIN_ERROR'));
    }
    
    next(error);
  }
};

// Register the route handler
router.post('/', upload.single('pdf'), handleUploadError, authenticateWallet, requireUniversityRole, requireSigningCapability, issueCertificate);

export default router;