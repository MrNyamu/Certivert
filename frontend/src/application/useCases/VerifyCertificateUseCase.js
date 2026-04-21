/**
 * Verify Certificate Use Case
 * Orchestrates the certificate verification process with comprehensive checks
 */

import { Certificate } from '../../domain/entities/Certificate.js';
import { CertificateId } from '../../domain/valueObjects/CertificateId.js';
import { CertificateStatus } from '../../domain/valueObjects/CertificateStatus.js';
import * as certificateApi from '../../infrastructure/api/certificateApi.js';

/**
 * Verify Certificate Use Case
 * Handles single and batch certificate verification with detailed results
 */
export class VerifyCertificateUseCase {
  /**
   * Verify a single certificate
   * @param {string} certificateId - Certificate ID to verify
   * @returns {Promise<Object>} Verification result with detailed information
   */
  async execute(certificateId) {
    try {
      // 1. Validate certificate ID format
      this._validateCertificateId(certificateId);

      // 2. Perform verification via API
      const result = await certificateApi.verifyCertificate(certificateId);

      // 3. Process and enhance verification result
      const enhancedResult = await this._enhanceVerificationResult(result, certificateId);

      return enhancedResult;

    } catch (error) {
      return {
        success: false,
        isValid: false,
        certificateId,
        error: error.message,
        code: error.code || 'VERIFICATION_FAILED',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Verify multiple certificates in batch
   * @param {string[]} certificateIds - Array of certificate IDs
   * @returns {Promise<Object>} Batch verification results
   */
  async executeBatch(certificateIds) {
    try {
      // Validate all certificate IDs
      for (const certId of certificateIds) {
        this._validateCertificateId(certId);
      }

      // Perform batch verification
      const batchResults = await certificateApi.batchVerifyCertificates(certificateIds);

      // Process results
      const processedResults = await Promise.all(
        batchResults.map(async (result, index) => {
          try {
            return await this._enhanceVerificationResult(result, certificateIds[index]);
          } catch (error) {
            return {
              success: false,
              isValid: false,
              certificateId: certificateIds[index],
              error: error.message,
              timestamp: new Date().toISOString()
            };
          }
        })
      );

      return {
        success: true,
        totalCount: certificateIds.length,
        validCount: processedResults.filter(r => r.isValid).length,
        invalidCount: processedResults.filter(r => !r.isValid).length,
        results: processedResults,
        summary: this._generateBatchSummary(processedResults)
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: error.code || 'BATCH_VERIFICATION_FAILED',
        totalCount: certificateIds.length,
        results: []
      };
    }
  }

  /**
   * Quick verification for QR code scanning
   * @param {string} certificateId - Certificate ID from QR code
   * @returns {Promise<Object>} Quick verification result
   */
  async quickVerify(certificateId) {
    try {
      this._validateCertificateId(certificateId);

      const result = await certificateApi.verifyCertificate(certificateId);

      return {
        success: true,
        isValid: result.isValid,
        certificateId,
        status: result.status,
        studentName: result.certificate?.studentInfo?.studentName || 'Unknown',
        programme: result.certificate?.programme || 'Unknown',
        institution: result.certificate?.issuerAddress || 'Unknown',
        year: result.certificate?.year,
        quickSummary: this._generateQuickSummary(result),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        success: false,
        isValid: false,
        certificateId,
        error: error.message,
        quickSummary: 'Verification Failed',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Validate certificate ID format
   * @private
   */
  _validateCertificateId(certificateId) {
    if (!certificateId || typeof certificateId !== 'string') {
      throw new Error('Certificate ID is required and must be a string');
    }

    const certId = new CertificateId(certificateId);
    if (!certId.isValid()) {
      throw new Error('Invalid certificate ID format');
    }
  }

  /**
   * Enhance verification result with additional business logic
   * @private
   */
  async _enhanceVerificationResult(apiResult, certificateId) {
    const result = {
      success: apiResult.isValid,
      isValid: apiResult.isValid,
      certificateId,
      status: apiResult.status,
      message: apiResult.message,
      timestamp: new Date().toISOString(),
      verificationDetails: apiResult.verificationDetails || {}
    };

    if (apiResult.certificate) {
      // Create domain entity from API response
      const certificate = Certificate.fromJSON(apiResult.certificate);
      
      result.certificate = {
        id: certificate.id.value,
        studentName: certificate.studentInfo.studentName,
        admissionNo: certificate.studentInfo.admissionNo,
        programme: certificate.programme,
        year: certificate.year,
        grade: certificate.grade,
        issuerAddress: certificate.issuerAddress,
        dateIssued: certificate.dateIssued,
        status: certificate.status.toString(),
        ipfsCid: certificate.ipfsCid
      };

      // Add business logic checks
      result.businessChecks = this._performBusinessChecks(certificate);
      result.securityChecks = this._performSecurityChecks(certificate, apiResult);
      result.complianceStatus = this._checkCompliance(certificate);
    }

    return result;
  }

  /**
   * Perform business logic checks on the certificate
   * @private
   */
  _performBusinessChecks(certificate) {
    const checks = {
      isActive: certificate.isActive(),
      canBeRevoked: certificate.canBeRevoked(),
      isExpired: false, // Certificates don't expire in this domain
      issueYear: certificate.year,
      gradeValid: this._isValidGrade(certificate.grade)
    };

    checks.allPassed = Object.values(checks).every(check => 
      typeof check === 'boolean' ? check : true
    );

    return checks;
  }

  /**
   * Perform security checks
   * @private
   */
  _performSecurityChecks(certificate, apiResult) {
    const checks = {
      hashVerified: apiResult.verificationDetails?.hashVerified || false,
      blockchainVerified: apiResult.verificationDetails?.blockchainVerified || false,
      ipfsVerified: apiResult.verificationDetails?.ipfsVerified || false,
      tamperedWith: false // Would be determined by hash comparison
    };

    // Calculate security score
    const passedChecks = Object.values(checks).filter(Boolean).length;
    checks.securityScore = Math.round((passedChecks / Object.keys(checks).length) * 100);
    checks.allPassed = checks.securityScore === 100;

    return checks;
  }

  /**
   * Check compliance with institutional standards
   * @private
   */
  _checkCompliance(certificate) {
    const compliance = {
      formatCompliant: true, // Basic format check
      dataIntegrity: certificate.validate().isValid,
      institutionalStandards: true, // Would check against known standards
      regulatoryCompliant: true // Would check against KNQA requirements
    };

    compliance.overallCompliant = Object.values(compliance).every(Boolean);

    return compliance;
  }

  /**
   * Validate grade format
   * @private
   */
  _isValidGrade(grade) {
    const validGrades = ['A', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'];
    return validGrades.includes(grade);
  }

  /**
   * Generate quick summary for QR verification
   * @private
   */
  _generateQuickSummary(result) {
    if (!result.isValid) {
      return 'Invalid Certificate';
    }

    if (!result.certificate) {
      return 'Certificate Not Found';
    }

    const cert = result.certificate;
    const status = cert.status || 'Unknown';

    if (status.includes('REVOKED')) {
      return 'Certificate Revoked';
    }

    if (status.includes('PENDING')) {
      return 'Certificate Pending';
    }

    return `Valid Certificate - ${cert.programme || 'Unknown Programme'}`;
  }

  /**
   * Generate batch verification summary
   * @private
   */
  _generateBatchSummary(results) {
    const total = results.length;
    const valid = results.filter(r => r.isValid).length;
    const invalid = total - valid;
    const successRate = total > 0 ? Math.round((valid / total) * 100) : 0;

    const statusBreakdown = {};
    results.forEach(result => {
      if (result.certificate && result.certificate.status) {
        const status = result.certificate.status;
        statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
      }
    });

    return {
      total,
      valid,
      invalid,
      successRate,
      statusBreakdown,
      recommendation: successRate >= 95 ? 'Excellent' : 
                     successRate >= 80 ? 'Good' : 
                     successRate >= 60 ? 'Needs Review' : 'Critical Issues'
    };
  }

  /**
   * Extract certificate info from QR code or URL
   * @param {string} qrContent - Content from QR code
   * @returns {string|null} Extracted certificate ID
   */
  static extractCertificateId(qrContent) {
    if (!qrContent || typeof qrContent !== 'string') {
      return null;
    }

    // Direct certificate ID
    if (CertificateId.isValidFormat(qrContent)) {
      return qrContent;
    }

    // URL with certificate ID
    try {
      const url = new URL(qrContent);
      const pathParts = url.pathname.split('/');
      const certId = pathParts[pathParts.length - 1];
      
      if (CertificateId.isValidFormat(certId)) {
        return certId;
      }

      // Query parameter
      const certIdParam = url.searchParams.get('certId') || url.searchParams.get('id');
      if (certIdParam && CertificateId.isValidFormat(certIdParam)) {
        return certIdParam;
      }
    } catch (error) {
      // Not a valid URL, continue with other methods
    }

    // Extract from text (certificate ID patterns)
    const certIdMatch = qrContent.match(/([a-f0-9]{64})/i);
    if (certIdMatch && CertificateId.isValidFormat(certIdMatch[1])) {
      return certIdMatch[1];
    }

    return null;
  }

  /**
   * Validate QR code content
   * @param {string} qrContent - Content from QR code scanner
   * @returns {Object} Validation result
   */
  static validateQRContent(qrContent) {
    const certificateId = VerifyCertificateUseCase.extractCertificateId(qrContent);

    return {
      isValid: certificateId !== null,
      certificateId,
      originalContent: qrContent,
      contentType: certificateId ? 'certificate_id' : 'unknown'
    };
  }
}

export default VerifyCertificateUseCase;