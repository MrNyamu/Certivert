/**
 * Pending Certificates Route Handler
 * GET /api/pending/issuances - Get pending certificate issuance requests
 * GET /api/pending/revocations - Get pending certificate revocation requests
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
// @ts-ignore - JS imports in mixed project
import { config } from '../config.js';
// @ts-ignore - JS imports in mixed project
import { createError } from '../middleware/errorHandler.js';
import { authenticateWallet, requireKNQARole, requireUniversityRole, requireCertificateManagementRole, type WalletAuthenticatedRequest } from '../middleware/auth.js';
// @ts-ignore - JS imports in mixed project
import { getCachedContractService } from '../services/contractFactory.js';

// Type imports
import type { RouteHandler } from '../types/api.js';

const router = Router();

/**
 * Interface for pending issuance response
 */
interface PendingIssuance {
  certId: string;
  universityPrincipal: string;
  studentName: string;
  admissionNo: string;
  programme: string;
  year: number;
  grade: string;
  ipfsCid: string;
  certHash: string;
  requestedAt: number;
}

/**
 * Interface for pending revocation response
 */
interface PendingRevocation {
  certId: string;
  initiator: string;
  initiatorRole: number;
  reason: string;
  requestedAt: number;
}

/**
 * Get pending certificate issuances (KNQA only)
 * GET /api/pending/issuances
 */
const getPendingIssuances = async (req: Request & WalletAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    console.log('🔍 Fetching pending certificate issuances...');

    // For now, we'll use a predefined list of cert-ids to check
    // In a production system, you'd maintain an index of pending requests
    const knownCertIds = [
      'V2VzbGV5IERvZSBCSU', // Sample cert IDs that might exist
      'Sm9obiBTbWl0aCBCU', 
      'SmFuZSBCcm93biBCU',
      'TWFyeSBKb2huc29uQ',
      'RGF2aWQgTGVlIE1iYQ'
    ];

    const contractService = await getCachedContractService();
    
    // Call the contract to get pending issuances in batch
    const pendingResult = await fetch(`${config.STACKS_API_URL}/v2/contracts/call-read/${config.CONTRACT_ADDRESS}/${config.CONTRACT_NAME_ROLES}/get-pending-issuances-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: config.CONTRACT_ADDRESS,
        arguments: [
          // Convert cert-ids to Clarity list format
          `[${knownCertIds.map(id => `"${id}"`).join(',')}]`
        ]
      })
    });

    if (!pendingResult.ok) {
      throw new Error('Failed to fetch pending issuances from blockchain');
    }

    const pendingData = await pendingResult.json();
    
    // Parse the result and filter out null entries
    const pendingIssuances: PendingIssuance[] = [];
    
    if (pendingData.result && pendingData.result.type === 'ok') {
      const resultList = pendingData.result.value;
      
      // Process each result in the batch
      for (let i = 0; i < knownCertIds.length; i++) {
        const certResult = resultList[i];
        
        if (certResult && certResult.type === 'ok' && certResult.value) {
          const pending = certResult.value;
          
          pendingIssuances.push({
            certId: knownCertIds[i],
            universityPrincipal: pending['university-principal'],
            studentName: pending['student-name'],
            admissionNo: String(pending['admission-no']),
            programme: pending.programme,
            year: parseInt(pending.year),
            grade: pending.grade,
            ipfsCid: pending['ipfs-cid'],
            certHash: pending['cert-hash'],
            requestedAt: parseInt(pending['requested-at'])
          });
        }
      }
    }

    console.log(`✅ Found ${pendingIssuances.length} pending issuances`);

    res.json({
      success: true,
      count: pendingIssuances.length,
      pending: pendingIssuances,
      message: `Found ${pendingIssuances.length} pending certificate issuances`
    });

  } catch (error) {
    console.error('❌ Error fetching pending issuances:', error);
    next(createError(500, 'Failed to fetch pending issuances', 'FETCH_PENDING_ERROR'));
  }
};

/**
 * Get pending certificate revocations (University/KNQA only)
 * GET /api/pending/revocations
 */
const getPendingRevocations = async (req: Request & WalletAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    console.log('🔍 Fetching pending certificate revocations...');

    // Sample cert-ids that might have pending revocations
    const knownCertIds = [
      'UmV2b2tlZFNhbXBsZQ', // Sample revoked cert IDs
      'Q2FuY2VsbGVkQ2VydA',
      'SW52YWxpZENlcnRpZg'
    ];

    // Call the contract to get pending revocations in batch
    const pendingResult = await fetch(`${config.STACKS_API_URL}/v2/contracts/call-read/${config.CONTRACT_ADDRESS}/${config.CONTRACT_NAME_ROLES}/get-pending-revocations-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: config.CONTRACT_ADDRESS,
        arguments: [
          `[${knownCertIds.map(id => `"${id}"`).join(',')}]`
        ]
      })
    });

    if (!pendingResult.ok) {
      throw new Error('Failed to fetch pending revocations from blockchain');
    }

    const pendingData = await pendingResult.json();
    
    // Parse the result and filter out null entries
    const pendingRevocations: PendingRevocation[] = [];
    
    if (pendingData.result && pendingData.result.type === 'ok') {
      const resultList = pendingData.result.value;
      
      // Process each result in the batch
      for (let i = 0; i < knownCertIds.length; i++) {
        const certResult = resultList[i];
        
        if (certResult && certResult.type === 'ok' && certResult.value) {
          const pending = certResult.value;
          
          pendingRevocations.push({
            certId: knownCertIds[i],
            initiator: pending.initiator,
            initiatorRole: parseInt(pending['initiator-role']),
            reason: pending.reason,
            requestedAt: parseInt(pending['requested-at'])
          });
        }
      }
    }

    console.log(`✅ Found ${pendingRevocations.length} pending revocations`);

    res.json({
      success: true,
      count: pendingRevocations.length,
      pending: pendingRevocations,
      message: `Found ${pendingRevocations.length} pending certificate revocations`
    });

  } catch (error) {
    console.error('❌ Error fetching pending revocations:', error);
    next(createError(500, 'Failed to fetch pending revocations', 'FETCH_PENDING_ERROR'));
  }
};

/**
 * Get single pending certificate issuance by cert-id (University/KNQA only)
 * GET /api/pending/issuance/:certId
 */
const getSinglePendingIssuance = async (req: Request & WalletAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { certId } = req.params;
    
    if (!certId) {
      return next(createError(400, 'Certificate ID is required', 'MISSING_CERT_ID'));
    }

    console.log(`🔍 Fetching pending issuance for cert-id: ${certId}`);

    // Call the contract to get single pending issuance
    const pendingResult = await fetch(`${config.STACKS_API_URL}/v2/contracts/call-read/${config.CONTRACT_ADDRESS}/${config.CONTRACT_NAME_ROLES}/get-pending-issuance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: req.wallet?.address || config.CONTRACT_ADDRESS, // Use the authenticated user's address
        arguments: [
          `"${certId}"` // Single cert-id as string
        ]
      })
    });

    if (!pendingResult.ok) {
      throw new Error('Failed to fetch pending issuance from blockchain');
    }

    const pendingData = await pendingResult.json();
    
    // Check if the result is ok and has data
    if (pendingData.result && pendingData.result.type === 'ok' && pendingData.result.value) {
      const pending = pendingData.result.value;
      
      const pendingIssuance: PendingIssuance = {
        certId: String(certId),
        universityPrincipal: pending['university-principal'],
        studentName: pending['student-name'],
        admissionNo: String(pending['admission-no']),
        programme: pending.programme,
        year: parseInt(pending.year),
        grade: pending.grade,
        ipfsCid: pending['ipfs-cid'],
        certHash: pending['cert-hash'],
        requestedAt: parseInt(pending['requested-at'])
      };

      console.log(`✅ Found pending issuance for cert-id: ${certId}`);

      res.json({
        success: true,
        certId: certId,
        pending: pendingIssuance,
        message: `Found pending certificate issuance for ${certId}`
      });
    } else {
      // No pending issuance found
      res.json({
        success: true,
        certId: certId,
        pending: null,
        message: `No pending issuance found for certificate ${certId}`
      });
    }

  } catch (error) {
    console.error(`❌ Error fetching pending issuance for ${req.params.certId}:`, error);
    next(createError(500, 'Failed to fetch pending issuance', 'FETCH_PENDING_ERROR'));
  }
};

// Register route handlers
router.get('/issuances', authenticateWallet, requireKNQARole, getPendingIssuances);
router.get('/issuance/:certId', authenticateWallet, requireCertificateManagementRole, getSinglePendingIssuance); // Both University and KNQA can access
router.get('/revocations', authenticateWallet, requireCertificateManagementRole, getPendingRevocations); // Updated to allow both roles

export default router;