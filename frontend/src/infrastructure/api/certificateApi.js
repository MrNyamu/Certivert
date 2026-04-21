/**
 * Certificate API Layer
 * Handles all certificate-related HTTP operations
 */

import { httpMethods, uploadFile } from './httpClient.js';
import { Certificate } from '../../domain/entities/Certificate.js';
import { CertificateId } from '../../domain/valueObjects/CertificateId.js';

/**
 * Certificate API endpoints
 */
const ENDPOINTS = {
  VERIFY: '/api/verify',
  ISSUE: '/api/issue',
  REVOKE: '/api/revoke',
  USER_CERTIFICATES: '/api/certificates',
  RECENT_ISSUANCES: '/api/recent',
  SYSTEM_STATS: '/api/stats',
  FILE_DOWNLOAD: '/api/files'
};

/**
 * Certificate verification
 * @param {string} certId - Certificate ID to verify
 * @returns {Promise<Object>} Verification result
 */
export async function verifyCertificate(certId) {
  try {
    // Validate certificate ID format
    if (!CertificateId.isValidFormat(certId)) {
      throw new Error('Invalid certificate ID format');
    }
    
    const response = await httpMethods.get(`${ENDPOINTS.VERIFY}/${certId}`);
    
    return {
      isValid: response.data.success,
      certificate: response.data.certificate ? Certificate.fromJSON(response.data.certificate) : null,
      status: response.data.status,
      message: response.data.message,
      verificationDetails: {
        hashVerified: response.data.hashVerified,
        blockchainVerified: response.data.blockchainVerified,
        ipfsVerified: response.data.ipfsVerified,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    throw new Error(`Certificate verification failed: ${error.userMessage || error.message}`);
  }
}

/**
 * Issue a new certificate
 * @param {Object} certificateData - Certificate data and file
 * @returns {Promise<Object>} Issuance result
 */
export async function issueCertificate(certificateData) {
  try {
    const { file, ...data } = certificateData;
    
    // Validate required fields
    const requiredFields = ['studentName', 'admissionNo', 'programme', 'year', 'grade'];
    for (const field of requiredFields) {
      if (!data[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    if (!file) {
      throw new Error('Certificate PDF file is required');
    }
    
    // Prepare form data
    const formData = new FormData();
    formData.append('pdf', file);
    
    // Append certificate data
    Object.keys(data).forEach(key => {
      formData.append(key, data[key]);
    });
    
    const response = await uploadFile(ENDPOINTS.ISSUE, formData, (progress) => {
      // Could dispatch progress updates to store
      console.log(`Upload progress: ${progress}%`);
    });
    
    return {
      success: true,
      certificateId: response.data.certId,
      ipfsCid: response.data.ipfsCid,
      proposeTxId: response.data.proposeTxId,
      approveTxId: response.data.approveTxId,
      status: response.data.status,
      message: response.data.message || 'Certificate issued successfully'
    };
  } catch (error) {
    throw new Error(`Certificate issuance failed: ${error.userMessage || error.message}`);
  }
}

/**
 * Revoke a certificate
 * @param {string} certId - Certificate ID to revoke
 * @param {string} reason - Revocation reason
 * @returns {Promise<Object>} Revocation result
 */
export async function revokeCertificate(certId, reason) {
  try {
    // Validate inputs
    if (!CertificateId.isValidFormat(certId)) {
      throw new Error('Invalid certificate ID format');
    }
    
    if (!reason || reason.trim().length === 0) {
      throw new Error('Revocation reason is required');
    }
    
    const response = await httpMethods.post(ENDPOINTS.REVOKE, {
      certId,
      reason: reason.trim()
    });
    
    return {
      success: true,
      certificateId: response.data.certId,
      transactionId: response.data.txId,
      status: response.data.status,
      message: response.data.message || 'Certificate revoked successfully',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    throw new Error(`Certificate revocation failed: ${error.userMessage || error.message}`);
  }
}

/**
 * Get user certificates
 * @param {string} address - User's wallet address
 * @returns {Promise<Certificate[]>} User's certificates
 */
export async function getUserCertificates(address) {
  try {
    if (!address) {
      throw new Error('User address is required');
    }
    
    const response = await httpMethods.get(`${ENDPOINTS.USER_CERTIFICATES}/${address}`);
    
    // Convert to domain entities
    return (response.data.certificates || []).map(certData => {
      try {
        return Certificate.fromJSON(certData);
      } catch (error) {
        console.warn('Invalid certificate data:', certData, error);
        return null;
      }
    }).filter(Boolean);
  } catch (error) {
    throw new Error(`Failed to fetch user certificates: ${error.userMessage || error.message}`);
  }
}

/**
 * Get recent issuances (for universities)
 * @param {string} issuerAddress - Issuer's wallet address
 * @returns {Promise<Object[]>} Recent issuances
 */
export async function getRecentIssuances(issuerAddress) {
  try {
    if (!issuerAddress) {
      throw new Error('Issuer address is required');
    }
    
    const response = await httpMethods.get(`${ENDPOINTS.RECENT_ISSUANCES}/${issuerAddress}`);
    
    return response.data.issuances || [];
  } catch (error) {
    throw new Error(`Failed to fetch recent issuances: ${error.userMessage || error.message}`);
  }
}

/**
 * Get system statistics (for KNQA)
 * @returns {Promise<Object>} System statistics
 */
export async function getSystemStats() {
  try {
    const response = await httpMethods.get(ENDPOINTS.SYSTEM_STATS);
    
    return {
      totalCertificates: response.data.totalCertificates || 0,
      activeCertificates: response.data.activeCertificates || 0,
      revokedCertificates: response.data.revokedCertificates || 0,
      pendingCertificates: response.data.pendingCertificates || 0,
      totalUniversities: response.data.totalUniversities || 0,
      recentActivity: response.data.recentActivity || [],
      blockchainHeight: response.data.blockchainHeight || 0,
      systemHealth: response.data.systemHealth || 'unknown',
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    throw new Error(`Failed to fetch system statistics: ${error.userMessage || error.message}`);
  }
}

/**
 * Download certificate file
 * @param {string} ipfsCid - IPFS Content ID
 * @param {string} filename - Optional filename for download
 * @returns {Promise<void>}
 */
export async function downloadCertificateFile(ipfsCid, filename = null) {
  try {
    if (!ipfsCid) {
      throw new Error('IPFS CID is required');
    }
    
    const downloadFilename = filename || `certificate-${ipfsCid.substring(0, 8)}.pdf`;
    
    const response = await httpMethods.get(`${ENDPOINTS.FILE_DOWNLOAD}/${ipfsCid}`, {
      responseType: 'blob'
    });
    
    // Create download link
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = downloadFilename;
    link.click();
    window.URL.revokeObjectURL(downloadUrl);
    
    return {
      success: true,
      filename: downloadFilename,
      size: response.data.size
    };
  } catch (error) {
    throw new Error(`File download failed: ${error.userMessage || error.message}`);
  }
}

/**
 * Get file information without downloading
 * @param {string} ipfsCid - IPFS Content ID
 * @returns {Promise<Object>} File information
 */
export async function getFileInfo(ipfsCid) {
  try {
    if (!ipfsCid) {
      throw new Error('IPFS CID is required');
    }
    
    const response = await httpMethods.get(`${ENDPOINTS.FILE_DOWNLOAD}/${ipfsCid}/info`);
    
    return {
      cid: response.data.cid,
      size: response.data.size,
      type: response.data.type,
      available: response.data.available,
      lastAccessed: response.data.lastAccessed
    };
  } catch (error) {
    throw new Error(`Failed to get file info: ${error.userMessage || error.message}`);
  }
}

/**
 * Batch certificate verification
 * @param {string[]} certIds - Array of certificate IDs
 * @returns {Promise<Object[]>} Batch verification results
 */
export async function batchVerifyCertificates(certIds) {
  try {
    if (!Array.isArray(certIds) || certIds.length === 0) {
      throw new Error('Certificate IDs array is required');
    }
    
    // Validate all certificate IDs
    for (const certId of certIds) {
      if (!CertificateId.isValidFormat(certId)) {
        throw new Error(`Invalid certificate ID format: ${certId}`);
      }
    }
    
    const response = await httpMethods.post(`${ENDPOINTS.VERIFY}/batch`, {
      certificateIds: certIds
    });
    
    return response.data.results || [];
  } catch (error) {
    throw new Error(`Batch verification failed: ${error.userMessage || error.message}`);
  }
}

/**
 * Search certificates (for KNQA)
 * @param {Object} searchParams - Search parameters
 * @returns {Promise<Certificate[]>} Search results
 */
export async function searchCertificates(searchParams) {
  try {
    const response = await httpMethods.post('/api/search', searchParams);
    
    return (response.data.certificates || []).map(certData => {
      try {
        return Certificate.fromJSON(certData);
      } catch (error) {
        console.warn('Invalid certificate data in search results:', certData, error);
        return null;
      }
    }).filter(Boolean);
  } catch (error) {
    throw new Error(`Certificate search failed: ${error.userMessage || error.message}`);
  }
}

// Export all functions as named exports
export {
  verifyCertificate as verify,
  issueCertificate as issue,
  revokeCertificate as revoke,
  getUserCertificates as getUserCerts,
  getRecentIssuances as getRecentIssues,
  getSystemStats as getStats,
  downloadCertificateFile as downloadFile,
  getFileInfo as getInfo,
  batchVerifyCertificates as batchVerify,
  searchCertificates as search
};