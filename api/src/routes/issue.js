import { Router } from 'express';
import upload, { handleUploadError } from '../middleware/upload.js';
import { computeCertHash } from '../services/hash.js';
import { uploadToIPFS, pinCID } from '../services/ipfs.js';
import { getCachedContractService } from '../services/contractFactory.js';
import { config } from '../config.js';
import { createError } from '../middleware/errorHandler.js';

const router = Router();

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
 */
router.post('/', upload.single('pdf'), handleUploadError, async (req, res, next) => {
  try {
    // Validate file upload
    if (!req.file) {
      throw createError(400, 'PDF file is required', 'MISSING_FILE');
    }
    
    // Validate required fields
    const { studentName, admissionNo, programme, year, grade } = req.body;
    
    const requiredFields = { studentName, admissionNo, programme, year, grade };
    for (const [field, value] of Object.entries(requiredFields)) {
      if (!value || value.trim() === '') {
        throw createError(400, `Missing required field: ${field}`, 'MISSING_FIELD');
      }
    }
    
    // Validate year
    const graduationYear = parseInt(year);
    if (isNaN(graduationYear) || graduationYear < 1900 || graduationYear > new Date().getFullYear() + 10) {
      throw createError(400, 'Invalid graduation year', 'INVALID_YEAR');
    }
    
    // Prepare certificate data
    const certData = {
      studentName: studentName.trim(),
      admissionNo: admissionNo.trim(),
      programme: programme.trim(),
      year: graduationYear,
      grade: grade.trim()
    };
    
    console.log('Processing certificate issuance:', certData);
    
    // Step 1: Compute certificate ID (SHA-256 hash of cert data)
    const certId = computeCertHash(certData);
    console.log(`Generated cert ID: ${certId}`);
    
    // Step 2: Upload encrypted PDF to IPFS
    console.log('Uploading PDF to IPFS...');
    const { cid } = await uploadToIPFS(req.file.buffer);
    
    // Add cert hash to data (for contract storage)
    certData.certHash = computeCertHash(certData); // Same as certId, but explicit
    
    // Step 3: Get contract service
    const contractService = await getCachedContractService();
    
    // Step 4: Propose certificate on blockchain
    console.log('Proposing certificate on blockchain...');
    const proposeTxId = await contractService.proposeCertificate(
      certId,
      certData,
      cid,
      config.STACKS_NETWORK === 'simnet' ? 'university' : config.DEPLOYER_PRIVATE_KEY
    );
    
    // Step 5: Auto-approve for prototype (2-of-2 multi-sig)
    // TODO: In production, this would be a separate action by Signer 2
    console.log('Auto-approving certificate (prototype mode)...');
    const approveTxId = await contractService.approveCertificate(
      certId,
      config.STACKS_NETWORK === 'simnet' ? 'signer2' : config.SIGNER_2_PRIVATE_KEY
    );
    
    // Step 6: Pin the CID on IPFS (after successful blockchain registration)
    console.log('Pinning content on IPFS...');
    await pinCID(cid);
    
    // Return success response
    const response = {
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
    console.error('Error in certificate issuance:', error);
    
    // Handle specific error types
    if (error.message.includes('already exists') || error.message.includes('already pending')) {
      return next(createError(409, 'Certificate with this ID already exists', 'DUPLICATE_CERT'));
    }
    
    if (error.message.includes('IPFS')) {
      return next(createError(503, 'IPFS service unavailable', 'IPFS_ERROR'));
    }
    
    if (error.message.includes('contract') || error.message.includes('blockchain')) {
      return next(createError(503, 'Blockchain service unavailable', 'BLOCKCHAIN_ERROR'));
    }
    
    next(error);
  }
});

export default router;