import { Router } from 'express';
import { getCachedContractService } from '../services/contractFactory.js';
import { fetchFromIPFS } from '../services/ipfs.js';
import { computeFileHash, isValidHash } from '../services/hash.js';
import { createError } from '../middleware/errorHandler.js';

const router = Router();

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
 */
router.get('/:certId', async (req, res, next) => {
  try {
    const { certId } = req.params;
    
    // Validate certificate ID format
    if (!certId || !isValidHash(certId)) {
      throw createError(400, 'Invalid certificate ID format', 'INVALID_CERT_ID');
    }
    
    console.log(`Verifying certificate: ${certId}`);
    
    // Step 1: Get contract service and verify certificate status
    const contractService = await getCachedContractService();
    const { status, certificate } = await contractService.verifyCertificate(certId);
    
    // Step 2: Handle NOT_FOUND case
    if (status === 'NOT_FOUND') {
      console.log(`Certificate not found: ${certId}`);
      return res.status(404).json({
        status: 'NOT_FOUND',
        message: 'Certificate not found'
      });
    }
    
    // Step 3: Handle REVOKED case
    if (status === 'REVOKED') {
      console.log(`Certificate revoked: ${certId}`);
      return res.status(200).json({
        status: 'REVOKED',
        certificate: {
          ...certificate,
          // Remove sensitive data for revoked certificates
          ipfsCid: undefined
        },
        message: 'Certificate has been revoked'
      });
    }
    
    // Step 4: Handle VALID case - verify PDF hash integrity
    if (status === 'VALID') {
      console.log(`Certificate found as valid, verifying PDF integrity...`);
      
      try {
        // Fetch encrypted PDF from IPFS
        const pdfBuffer = await fetchFromIPFS(certificate.ipfsCid);
        
        // Compute hash of decrypted PDF
        const computedHash = computeFileHash(pdfBuffer);
        
        // Compare with stored hash in certificate
        const hashVerified = computedHash === certificate.certHash;
        
        if (hashVerified) {
          console.log(`Certificate verified successfully: ${certId}`);
          return res.status(200).json({
            status: 'VALID',
            certificate,
            hashVerified: true,
            message: 'Certificate is valid and authentic'
          });
        } else {
          console.warn(`Hash mismatch detected for certificate: ${certId}`);
          console.warn(`Expected: ${certificate.certHash}, Computed: ${computedHash}`);
          
          return res.status(200).json({
            status: 'TAMPERED',
            certificate,
            hashVerified: false,
            message: 'Certificate data may have been tampered with'
          });
        }
        
      } catch (ipfsError) {
        console.error(`Error fetching PDF for certificate ${certId}:`, ipfsError);
        
        // Return certificate info but indicate PDF verification failed
        return res.status(200).json({
          status: 'VALID',
          certificate: {
            ...certificate,
            // Remove IPFS CID if we can't fetch the PDF
            ipfsCid: undefined
          },
          hashVerified: false,
          message: 'Certificate is valid but PDF could not be retrieved for verification',
          warning: 'PDF verification failed - IPFS content may be unavailable'
        });
      }
    }
    
    // Step 5: Handle unknown status (should not happen)
    throw createError(500, `Unknown certificate status: ${status}`, 'UNKNOWN_STATUS');
    
  } catch (error) {
    console.error('Error in certificate verification:', error);
    
    // Handle specific error types
    if (error.message.includes('contract') || error.message.includes('blockchain')) {
      return next(createError(503, 'Blockchain service unavailable', 'BLOCKCHAIN_ERROR'));
    }
    
    if (error.message.includes('IPFS')) {
      return next(createError(503, 'IPFS service unavailable', 'IPFS_ERROR'));
    }
    
    next(error);
  }
});

export default router;