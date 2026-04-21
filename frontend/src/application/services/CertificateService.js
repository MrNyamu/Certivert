/**
 * Certificate Application Service
 * Coordinates certificate operations and business workflows
 */

import { IssueCertificateUseCase } from '../useCases/IssueCertificateUseCase.js';
import { VerifyCertificateUseCase } from '../useCases/VerifyCertificateUseCase.js';
import { RevokeCertificateUseCase } from '../useCases/RevokeCertificateUseCase.js';
import * as certificateApi from '../../infrastructure/api/certificateApi.js';
import * as authApi from '../../infrastructure/api/authApi.js';

/**
 * Certificate Service
 * High-level service that coordinates certificate operations
 * and provides a unified interface for the presentation layer
 */
export class CertificateService {
  constructor() {
    this.issueCertificateUseCase = new IssueCertificateUseCase();
    this.verifyCertificateUseCase = new VerifyCertificateUseCase();
    this.revokeCertificateUseCase = new RevokeCertificateUseCase();
  }

  /**
   * Issue a new certificate
   * @param {Object} params - Issuance parameters
   * @returns {Promise<Object>} Issuance result
   */
  async issueCertificate(params) {
    return await this.issueCertificateUseCase.execute(params);
  }

  /**
   * Verify a certificate
   * @param {string} certificateId - Certificate ID to verify
   * @returns {Promise<Object>} Verification result
   */
  async verifyCertificate(certificateId) {
    return await this.verifyCertificateUseCase.execute(certificateId);
  }

  /**
   * Quick verify for QR codes
   * @param {string} certificateId - Certificate ID
   * @returns {Promise<Object>} Quick verification result
   */
  async quickVerifyCertificate(certificateId) {
    return await this.verifyCertificateUseCase.quickVerify(certificateId);
  }

  /**
   * Verify multiple certificates
   * @param {string[]} certificateIds - Array of certificate IDs
   * @returns {Promise<Object>} Batch verification result
   */
  async batchVerifyCertificates(certificateIds) {
    return await this.verifyCertificateUseCase.executeBatch(certificateIds);
  }

  /**
   * Revoke a certificate
   * @param {Object} params - Revocation parameters
   * @returns {Promise<Object>} Revocation result
   */
  async revokeCertificate(params) {
    return await this.revokeCertificateUseCase.execute(params);
  }

  /**
   * Check if certificate can be revoked
   * @param {string} certificateId - Certificate ID
   * @param {string} userAddress - User address
   * @returns {Promise<Object>} Revocation eligibility
   */
  async checkRevocationEligibility(certificateId, userAddress) {
    return await this.revokeCertificateUseCase.checkRevocationEligibility(certificateId, userAddress);
  }

  /**
   * Get user's certificates
   * @param {string} userAddress - User wallet address
   * @returns {Promise<Object>} User certificates
   */
  async getUserCertificates(userAddress) {
    try {
      const certificates = await certificateApi.getUserCertificates(userAddress);
      
      return {
        success: true,
        certificates: certificates.map(cert => ({
          id: cert.id.value,
          studentName: cert.studentInfo.studentName,
          programme: cert.programme,
          year: cert.year,
          grade: cert.grade,
          status: cert.status.toString(),
          dateIssued: cert.dateIssued,
          isActive: cert.isActive(),
          canBeRevoked: cert.canBeRevoked()
        })),
        count: certificates.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        certificates: [],
        count: 0
      };
    }
  }

  /**
   * Get recent issuances for universities
   * @param {string} issuerAddress - University address
   * @returns {Promise<Object>} Recent issuances
   */
  async getRecentIssuances(issuerAddress) {
    try {
      const issuances = await certificateApi.getRecentIssuances(issuerAddress);
      
      return {
        success: true,
        issuances,
        count: issuances.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        issuances: [],
        count: 0
      };
    }
  }

  /**
   * Get system statistics for KNQA
   * @returns {Promise<Object>} System statistics
   */
  async getSystemStatistics() {
    try {
      const stats = await certificateApi.getSystemStats();
      
      return {
        success: true,
        statistics: {
          ...stats,
          trends: this._calculateTrends(stats),
          healthScore: this._calculateSystemHealth(stats)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        statistics: null
      };
    }
  }

  /**
   * Download certificate file
   * @param {string} ipfsCid - IPFS content ID
   * @param {string} filename - Optional filename
   * @returns {Promise<Object>} Download result
   */
  async downloadCertificateFile(ipfsCid, filename) {
    try {
      const result = await certificateApi.downloadCertificateFile(ipfsCid, filename);
      return { success: true, ...result };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Search certificates (for KNQA)
   * @param {Object} searchParams - Search parameters
   * @returns {Promise<Object>} Search results
   */
  async searchCertificates(searchParams) {
    try {
      const certificates = await certificateApi.searchCertificates(searchParams);
      
      return {
        success: true,
        certificates: certificates.map(cert => ({
          id: cert.id.value,
          studentName: cert.studentInfo.studentName,
          programme: cert.programme,
          year: cert.year,
          grade: cert.grade,
          status: cert.status.toString(),
          issuerAddress: cert.issuerAddress,
          dateIssued: cert.dateIssued
        })),
        count: certificates.length,
        searchParams
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        certificates: [],
        count: 0
      };
    }
  }

  /**
   * Validate certificate data before issuance
   * @param {Object} certificateData - Certificate data to validate
   * @returns {Object} Validation result
   */
  validateCertificateData(certificateData) {
    return IssueCertificateUseCase.previewCertificate(certificateData);
  }

  /**
   * Validate certificate file
   * @param {File} file - Certificate file
   * @returns {Object} Validation result
   */
  validateCertificateFile(file) {
    try {
      IssueCertificateUseCase.validateFile(file);
      return {
        isValid: true,
        file: {
          name: file.name,
          size: file.size,
          type: file.type,
          sizeFormatted: this._formatFileSize(file.size)
        }
      };
    } catch (error) {
      return {
        isValid: false,
        error: error.message
      };
    }
  }

  /**
   * Extract certificate ID from QR code content
   * @param {string} qrContent - QR code content
   * @returns {Object} Extraction result
   */
  extractCertificateFromQR(qrContent) {
    return VerifyCertificateUseCase.validateQRContent(qrContent);
  }

  /**
   * Get dashboard data for user based on role
   * @param {string} userAddress - User address
   * @returns {Promise<Object>} Dashboard data
   */
  async getDashboardData(userAddress) {
    try {
      const user = await authApi.getUserProfile(userAddress);
      const dashboardData = {
        user: {
          address: user.address.value,
          role: user.role.toStringValue(),
          displayName: user.getDisplayName()
        },
        data: {}
      };

      if (user.isStudent()) {
        // Student dashboard data
        const userCerts = await this.getUserCertificates(userAddress);
        dashboardData.data = {
          certificates: userCerts.certificates,
          totalCertificates: userCerts.count,
          activeCertificates: userCerts.certificates.filter(c => c.isActive).length
        };
      } else if (user.isUniversity()) {
        // University dashboard data
        const recentIssuances = await this.getRecentIssuances(userAddress);
        dashboardData.data = {
          recentIssuances: recentIssuances.issuances,
          totalIssued: recentIssuances.count,
          pendingApprovals: recentIssuances.issuances.filter(i => i.status?.includes('PENDING')).length
        };
      } else if (user.isKNQA()) {
        // KNQA dashboard data
        const systemStats = await this.getSystemStatistics();
        dashboardData.data = systemStats.statistics;
      }

      return {
        success: true,
        dashboardData
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        dashboardData: null
      };
    }
  }

  /**
   * Calculate trends from statistics
   * @private
   */
  _calculateTrends(stats) {
    // Simple trend calculation - in production would use historical data
    const total = stats.totalCertificates || 0;
    const active = stats.activeCertificates || 0;
    const revoked = stats.revokedCertificates || 0;

    return {
      issuanceRate: total > 0 ? Math.round((active / total) * 100) : 0,
      revocationRate: total > 0 ? Math.round((revoked / total) * 100) : 0,
      growthTrend: 'stable' // Would be calculated from time series data
    };
  }

  /**
   * Calculate system health score
   * @private
   */
  _calculateSystemHealth(stats) {
    let score = 100;
    const total = stats.totalCertificates || 0;
    
    if (total === 0) return 50; // Neutral score for new system
    
    // Deduct points for high revocation rate
    const revocationRate = (stats.revokedCertificates || 0) / total;
    if (revocationRate > 0.1) score -= 20; // More than 10% revoked
    if (revocationRate > 0.05) score -= 10; // More than 5% revoked
    
    // Deduct points for too many pending certificates
    const pendingRate = (stats.pendingCertificates || 0) / total;
    if (pendingRate > 0.2) score -= 15; // More than 20% pending
    if (pendingRate > 0.1) score -= 10; // More than 10% pending
    
    // Blockchain health check
    if (stats.systemHealth !== 'healthy') {
      score -= 25;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Format file size for display
   * @private
   */
  _formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get available revocation reasons
   * @returns {Object[]} Available reasons
   */
  getRevocationReasons() {
    return RevokeCertificateUseCase.getAvailableReasons();
  }

  /**
   * Validate revocation reason
   * @param {string} reason - Reason to validate
   * @returns {Object} Validation result
   */
  validateRevocationReason(reason) {
    return RevokeCertificateUseCase.validateRevocationReason(reason);
  }
}

// Export singleton instance
export default new CertificateService();