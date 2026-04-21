/**
 * Issue Certificate Use Case
 * Orchestrates the certificate issuance process following business rules
 */

import { Certificate } from '../../domain/entities/Certificate.js';
import { CertificateId } from '../../domain/valueObjects/CertificateId.js';
import { CertificateStatus } from '../../domain/valueObjects/CertificateStatus.js';
import { StudentInfo } from '../../domain/valueObjects/StudentInfo.js';
import * as certificateApi from '../../infrastructure/api/certificateApi.js';
import * as authApi from '../../infrastructure/api/authApi.js';

/**
 * Issue Certificate Use Case
 * Business logic for issuing new certificates
 */
export class IssueCertificateUseCase {
  /**
   * Execute the certificate issuance process
   * @param {Object} params - Issuance parameters
   * @param {string} params.issuerAddress - University wallet address
   * @param {Object} params.certificateData - Certificate information
   * @param {File} params.file - PDF certificate file
   * @returns {Promise<Object>} Issuance result
   */
  async execute(params) {
    const { issuerAddress, certificateData, file } = params;

    try {
      // 1. Validate issuer permissions
      await this._validateIssuerPermissions(issuerAddress);

      // 2. Validate certificate data
      const validatedData = await this._validateCertificateData(certificateData);

      // 3. Create domain entity
      const certificate = this._createCertificateEntity(validatedData, issuerAddress);

      // 4. Validate business rules
      this._validateBusinessRules(certificate);

      // 5. Issue certificate via API
      const result = await certificateApi.issueCertificate({
        ...validatedData,
        file,
        issuerAddress
      });

      // 6. Return success result
      return {
        success: true,
        certificateId: result.certificateId,
        certificate: certificate,
        transactionDetails: {
          proposeTxId: result.proposeTxId,
          approveTxId: result.approveTxId,
          ipfsCid: result.ipfsCid
        },
        message: result.message
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: error.code || 'ISSUANCE_FAILED'
      };
    }
  }

  /**
   * Validate that the issuer has permission to issue certificates
   * @private
   */
  async _validateIssuerPermissions(issuerAddress) {
    const user = await authApi.getUserProfile(issuerAddress);
    
    if (!user.canIssueCertificates()) {
      throw new Error('Issuer does not have permission to issue certificates');
    }

    if (!user.isActive()) {
      throw new Error('Issuer account is not active');
    }
  }

  /**
   * Validate and normalize certificate data
   * @private
   */
  async _validateCertificateData(certificateData) {
    const required = ['studentName', 'admissionNo', 'programme', 'year', 'grade'];
    
    for (const field of required) {
      if (!certificateData[field] || certificateData[field].toString().trim() === '') {
        throw new Error(`Required field missing or empty: ${field}`);
      }
    }

    // Validate student info format
    const studentInfo = new StudentInfo({
      studentName: certificateData.studentName.trim(),
      admissionNo: certificateData.admissionNo.trim(),
      programme: certificateData.programme.trim(),
      year: parseInt(certificateData.year),
      grade: certificateData.grade.trim()
    });

    if (!studentInfo.isValid()) {
      throw new Error('Invalid student information provided');
    }

    return {
      studentName: studentInfo.studentName,
      admissionNo: studentInfo.admissionNo,
      programme: studentInfo.programme,
      year: studentInfo.year,
      grade: studentInfo.grade,
      dateIssued: certificateData.dateIssued || new Date().toISOString(),
      additionalData: certificateData.additionalData || {}
    };
  }

  /**
   * Create certificate domain entity
   * @private
   */
  _createCertificateEntity(certificateData, issuerAddress) {
    // Generate certificate ID based on content
    const contentHash = this._generateContentHash(certificateData);
    
    return new Certificate({
      id: new CertificateId(contentHash),
      studentInfo: new StudentInfo(certificateData),
      programme: certificateData.programme,
      year: certificateData.year,
      grade: certificateData.grade,
      issuerAddress,
      dateIssued: new Date(certificateData.dateIssued),
      status: new CertificateStatus(CertificateStatus.PENDING_ISSUE),
      additionalData: certificateData.additionalData
    });
  }

  /**
   * Validate business rules for certificate issuance
   * @private
   */
  _validateBusinessRules(certificate) {
    // Check if certificate data is valid
    const validationResult = certificate.validate();
    if (!validationResult.isValid) {
      throw new Error(`Certificate validation failed: ${validationResult.errors.join(', ')}`);
    }

    // Check year validity
    const currentYear = new Date().getFullYear();
    if (certificate.year > currentYear) {
      throw new Error('Certificate year cannot be in the future');
    }

    if (certificate.year < 1950) {
      throw new Error('Certificate year is too old');
    }

    // Validate grade format
    const validGrades = ['A', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'];
    if (!validGrades.includes(certificate.grade)) {
      throw new Error(`Invalid grade: ${certificate.grade}. Must be one of: ${validGrades.join(', ')}`);
    }
  }

  /**
   * Generate content hash for certificate ID
   * @private
   */
  _generateContentHash(certificateData) {
    // Simple content-based hash (in production, use proper crypto)
    const content = JSON.stringify({
      studentName: certificateData.studentName,
      admissionNo: certificateData.admissionNo,
      programme: certificateData.programme,
      year: certificateData.year,
      grade: certificateData.grade,
      dateIssued: certificateData.dateIssued
    });

    // Simplified hash generation - in production use crypto.createHash('sha256')
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Convert to hex and pad to 64 characters
    return Math.abs(hash).toString(16).padStart(64, '0');
  }

  /**
   * Validate file requirements
   * @param {File} file - Certificate PDF file
   * @returns {boolean} Validation result
   */
  static validateFile(file) {
    if (!file) {
      throw new Error('Certificate PDF file is required');
    }

    if (file.type !== 'application/pdf') {
      throw new Error('Certificate must be a PDF file');
    }

    // 10MB limit
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('Certificate file size must not exceed 10MB');
    }

    return true;
  }

  /**
   * Preview certificate data before issuance
   * @param {Object} certificateData - Certificate data to preview
   * @returns {Object} Preview information
   */
  static previewCertificate(certificateData) {
    try {
      const studentInfo = new StudentInfo(certificateData);
      
      return {
        isValid: studentInfo.isValid(),
        preview: {
          fullName: studentInfo.studentName,
          admissionNumber: studentInfo.admissionNo,
          programme: certificateData.programme,
          graduationYear: certificateData.year,
          grade: certificateData.grade,
          formattedInfo: `${studentInfo.studentName} (${studentInfo.admissionNo}) - ${certificateData.programme} ${certificateData.year}`
        },
        warnings: IssueCertificateUseCase._generatePreviewWarnings(certificateData)
      };
    } catch (error) {
      return {
        isValid: false,
        error: error.message,
        warnings: []
      };
    }
  }

  /**
   * Generate preview warnings
   * @private
   */
  static _generatePreviewWarnings(data) {
    const warnings = [];
    const currentYear = new Date().getFullYear();

    if (data.year === currentYear) {
      warnings.push('Certificate is for the current year');
    }

    if (data.year > currentYear - 2) {
      warnings.push('Recent graduation - ensure all requirements are met');
    }

    if (!data.dateIssued) {
      warnings.push('Issue date will be set to current date');
    }

    return warnings;
  }
}

export default IssueCertificateUseCase;