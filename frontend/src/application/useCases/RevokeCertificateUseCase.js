/**
 * Revoke Certificate Use Case
 * Orchestrates the certificate revocation process with authorization and audit
 */

import { Certificate } from '../../domain/entities/Certificate.js';
import { CertificateId } from '../../domain/valueObjects/CertificateId.js';
import { CertificateStatus } from '../../domain/valueObjects/CertificateStatus.js';
import * as certificateApi from '../../infrastructure/api/certificateApi.js';
import * as authApi from '../../infrastructure/api/authApi.js';

/**
 * Revocation reasons enum
 */
export const RevocationReasons = {
  FRAUD: 'fraud',
  ERROR_IN_ISSUANCE: 'error_in_issuance',
  STUDENT_REQUEST: 'student_request',
  ACADEMIC_MISCONDUCT: 'academic_misconduct',
  DUPLICATE_ISSUANCE: 'duplicate_issuance',
  INSTITUTIONAL_POLICY: 'institutional_policy',
  OTHER: 'other'
};

/**
 * Revoke Certificate Use Case
 * Handles certificate revocation with proper authorization and audit trail
 */
export class RevokeCertificateUseCase {
  /**
   * Execute certificate revocation
   * @param {Object} params - Revocation parameters
   * @param {string} params.certificateId - Certificate ID to revoke
   * @param {string} params.reason - Revocation reason
   * @param {string} params.revokerAddress - Address of person performing revocation
   * @param {string} params.additionalNotes - Optional additional notes
   * @returns {Promise<Object>} Revocation result
   */
  async execute(params) {
    const { certificateId, reason, revokerAddress, additionalNotes = '' } = params;

    try {
      // 1. Validate inputs
      this._validateInputs(certificateId, reason, revokerAddress);

      // 2. Get certificate details
      const certificate = await this._getCertificateDetails(certificateId);

      // 3. Validate authorization
      await this._validateRevocationAuthorization(certificate, revokerAddress);

      // 4. Check if certificate can be revoked
      this._validateRevocationEligibility(certificate);

      // 5. Perform revocation via API
      const result = await certificateApi.revokeCertificate(certificateId, this._formatRevocationReason(reason, additionalNotes));

      // 6. Create audit trail
      const auditInfo = this._createAuditTrail(certificate, revokerAddress, reason, additionalNotes);

      return {
        success: true,
        certificateId,
        transactionId: result.transactionId,
        revocationTimestamp: result.timestamp || new Date().toISOString(),
        revokerAddress,
        reason,
        auditInfo,
        message: result.message || 'Certificate revoked successfully'
      };

    } catch (error) {
      return {
        success: false,
        certificateId,
        error: error.message,
        code: error.code || 'REVOCATION_FAILED',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Check if a certificate can be revoked
   * @param {string} certificateId - Certificate ID to check
   * @param {string} userAddress - Address of user requesting check
   * @returns {Promise<Object>} Revocation eligibility check
   */
  async checkRevocationEligibility(certificateId, userAddress) {
    try {
      this._validateInputs(certificateId, 'check', userAddress);

      const certificate = await this._getCertificateDetails(certificateId);
      const user = await authApi.getUserProfile(userAddress);

      const eligibility = {
        canRevoke: false,
        reasons: [],
        restrictions: []
      };

      // Check certificate status
      if (!certificate.canBeRevoked()) {
        eligibility.restrictions.push('Certificate is not in a revokable state');
      } else {
        eligibility.canRevoke = true;
      }

      // Check user authorization
      if (!user.canRevokeCertificates() && certificate.issuerAddress !== userAddress) {
        eligibility.restrictions.push('User does not have permission to revoke certificates');
        eligibility.canRevoke = false;
      }

      // Check if user is the issuer
      if (certificate.issuerAddress === userAddress) {
        eligibility.reasons.push('User is the original issuer');
      }

      // Check if user has admin privileges
      if (user.isKNQA()) {
        eligibility.reasons.push('User has KNQA administrative privileges');
        eligibility.canRevoke = true; // Admin override
      }

      return {
        success: true,
        certificateId,
        eligibility,
        certificate: {
          studentName: certificate.studentInfo.studentName,
          programme: certificate.programme,
          year: certificate.year,
          status: certificate.status.toString(),
          issuer: certificate.issuerAddress
        }
      };

    } catch (error) {
      return {
        success: false,
        certificateId,
        error: error.message,
        eligibility: { canRevoke: false, reasons: [], restrictions: [error.message] }
      };
    }
  }

  /**
   * Get revocation history for a certificate
   * @param {string} certificateId - Certificate ID
   * @returns {Promise<Object>} Revocation history
   */
  async getRevocationHistory(certificateId) {
    try {
      this._validateCertificateId(certificateId);

      // This would typically come from a blockchain transaction history
      // For now, we'll return a placeholder structure
      return {
        success: true,
        certificateId,
        revocationHistory: [],
        currentStatus: 'active', // Would be fetched from current certificate state
        lastUpdated: new Date().toISOString()
      };

    } catch (error) {
      return {
        success: false,
        certificateId,
        error: error.message
      };
    }
  }

  /**
   * Validate inputs for revocation
   * @private
   */
  _validateInputs(certificateId, reason, revokerAddress) {
    this._validateCertificateId(certificateId);

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      throw new Error('Revocation reason is required');
    }

    if (!revokerAddress || typeof revokerAddress !== 'string') {
      throw new Error('Revoker address is required');
    }

    if (!Object.values(RevocationReasons).includes(reason) && reason !== 'check') {
      throw new Error(`Invalid revocation reason. Must be one of: ${Object.values(RevocationReasons).join(', ')}`);
    }
  }

  /**
   * Validate certificate ID format
   * @private
   */
  _validateCertificateId(certificateId) {
    if (!certificateId || typeof certificateId !== 'string') {
      throw new Error('Certificate ID is required');
    }

    const certId = new CertificateId(certificateId);
    if (!certId.isValid()) {
      throw new Error('Invalid certificate ID format');
    }
  }

  /**
   * Get certificate details for revocation
   * @private
   */
  async _getCertificateDetails(certificateId) {
    const verificationResult = await certificateApi.verifyCertificate(certificateId);

    if (!verificationResult.isValid || !verificationResult.certificate) {
      throw new Error('Certificate not found or invalid');
    }

    return Certificate.fromJSON(verificationResult.certificate);
  }

  /**
   * Validate if user has authorization to revoke certificate
   * @private
   */
  async _validateRevocationAuthorization(certificate, revokerAddress) {
    const user = await authApi.getUserProfile(revokerAddress);

    // Check if user is the original issuer
    if (certificate.issuerAddress === revokerAddress) {
      if (!user.canRevokeCertificates()) {
        throw new Error('User no longer has permission to revoke certificates');
      }
      return; // Issuer can revoke their own certificates
    }

    // Check if user is KNQA admin
    if (user.isKNQA()) {
      return; // KNQA can revoke any certificate
    }

    // Otherwise, not authorized
    throw new Error('User is not authorized to revoke this certificate');
  }

  /**
   * Validate if certificate is eligible for revocation
   * @private
   */
  _validateRevocationEligibility(certificate) {
    if (!certificate.canBeRevoked()) {
      const status = certificate.status.toString();
      
      if (status.includes('REVOKED')) {
        throw new Error('Certificate is already revoked');
      }
      
      if (status.includes('PENDING')) {
        throw new Error('Certificate is still pending and cannot be revoked');
      }
      
      throw new Error('Certificate is not eligible for revocation');
    }

    // Additional business rules
    const daysSinceIssue = Math.floor((Date.now() - certificate.dateIssued.getTime()) / (1000 * 60 * 60 * 24));
    
    // Example: Certificates older than 10 years require special authorization
    if (daysSinceIssue > 365 * 10) {
      throw new Error('Certificate is too old for standard revocation process. Special authorization required.');
    }
  }

  /**
   * Format revocation reason for API
   * @private
   */
  _formatRevocationReason(reason, additionalNotes) {
    const reasonDescriptions = {
      [RevocationReasons.FRAUD]: 'Fraudulent certificate detected',
      [RevocationReasons.ERROR_IN_ISSUANCE]: 'Error in original certificate issuance',
      [RevocationReasons.STUDENT_REQUEST]: 'Revocation requested by student',
      [RevocationReasons.ACADEMIC_MISCONDUCT]: 'Academic misconduct discovered',
      [RevocationReasons.DUPLICATE_ISSUANCE]: 'Duplicate certificate issuance',
      [RevocationReasons.INSTITUTIONAL_POLICY]: 'Institutional policy violation',
      [RevocationReasons.OTHER]: 'Other reason'
    };

    const description = reasonDescriptions[reason] || reason;
    
    if (additionalNotes && additionalNotes.trim().length > 0) {
      return `${description}. Additional notes: ${additionalNotes.trim()}`;
    }

    return description;
  }

  /**
   * Create audit trail for revocation
   * @private
   */
  _createAuditTrail(certificate, revokerAddress, reason, additionalNotes) {
    return {
      action: 'revoke_certificate',
      certificateId: certificate.id.value,
      studentName: certificate.studentInfo.studentName,
      programme: certificate.programme,
      originalIssuer: certificate.issuerAddress,
      revokerAddress,
      reason,
      additionalNotes,
      timestamp: new Date().toISOString(),
      previousStatus: certificate.status.toString(),
      newStatus: 'REVOKED'
    };
  }

  /**
   * Validate revocation reason
   * @param {string} reason - Revocation reason to validate
   * @returns {Object} Validation result
   */
  static validateRevocationReason(reason) {
    if (!reason || typeof reason !== 'string') {
      return {
        isValid: false,
        error: 'Reason is required and must be a string'
      };
    }

    if (!Object.values(RevocationReasons).includes(reason)) {
      return {
        isValid: false,
        error: `Invalid reason. Must be one of: ${Object.values(RevocationReasons).join(', ')}`
      };
    }

    return {
      isValid: true,
      reason,
      description: RevokeCertificateUseCase._getReasonDescription(reason)
    };
  }

  /**
   * Get description for revocation reason
   * @private
   */
  static _getReasonDescription(reason) {
    const descriptions = {
      [RevocationReasons.FRAUD]: 'Certificate was issued fraudulently or contains fraudulent information',
      [RevocationReasons.ERROR_IN_ISSUANCE]: 'Certificate contains errors that occurred during the issuance process',
      [RevocationReasons.STUDENT_REQUEST]: 'Student has requested the revocation of their certificate',
      [RevocationReasons.ACADEMIC_MISCONDUCT]: 'Academic misconduct was discovered after certificate issuance',
      [RevocationReasons.DUPLICATE_ISSUANCE]: 'Certificate was issued in duplicate (multiple certificates for same qualification)',
      [RevocationReasons.INSTITUTIONAL_POLICY]: 'Revocation required due to institutional policy changes or violations',
      [RevocationReasons.OTHER]: 'Other reason not covered by standard categories'
    };

    return descriptions[reason] || 'Unknown reason';
  }

  /**
   * Get available revocation reasons
   * @returns {Object[]} Available reasons with descriptions
   */
  static getAvailableReasons() {
    return Object.values(RevocationReasons).map(reason => ({
      value: reason,
      label: reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      description: RevokeCertificateUseCase._getReasonDescription(reason)
    }));
  }
}

export default RevokeCertificateUseCase;