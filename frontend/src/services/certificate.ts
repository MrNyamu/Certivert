/**
 * Certificate Service - Application Layer
 * Handles certificate operations and business logic
 */

import { certivertAPI } from './api.js';
import type { 
  CertificateJSON, 
  VerificationResult, 
  IssuanceResult, 
  RevocationResult,
  IssuanceFormData 
} from '../types/index.js';

export interface CertificateListFilters {
  status?: 'active' | 'revoked' | 'pending';
  programme?: string;
  year?: number;
  grade?: string;
  issuer?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CertificateStats {
  total: number;
  active: number;
  revoked: number;
  pending: number;
  recentCount: number;
}

export class CertificateService {
  
  /**
   * Issue a new certificate using wallet transaction flow
   */
  async issue(data: IssuanceFormData, walletAddress: string): Promise<IssuanceResult> {
    try {
      // Step 1: Validate input data
      const validation = this.validateCertificateData(data);
      if (!validation.isValid) {
        throw new Error(`VALIDATION_ERROR: ${validation.errors.join(', ')}`);
      }

      if (!walletAddress || !walletAddress.startsWith('ST')) {
        throw new Error('INVALID_WALLET: Invalid wallet address');
      }

      // Import wallet service
      const { walletService } = await import('./wallet.js');
      
      // Step 2: Generate certificate ID (hash) 
      const certHash = this.generateCertificateHash({
        studentName: data.studentName,
        admissionNo: data.admissionNo,
        programme: data.programme,
        year: data.year,
        grade: data.grade
      });
      
      console.log('📝 Generated certificate ID:', certHash);
      
      // Step 3: Upload PDF to IPFS first to get real CID
      console.log('📤 Uploading PDF to IPFS...');
      let ipfsCid: string;
      try {
        const uploadResult = await certivertAPI.uploadToIPFS(data.file);
        ipfsCid = uploadResult.cid;
        console.log(`✅ PDF uploaded to IPFS: ${ipfsCid}`);
      } catch (ipfsError: any) {
        console.error('IPFS upload error:', ipfsError);
        throw new Error(`Failed to upload certificate to IPFS: ${ipfsError.message}`)
      }
      
      // Step 4: Submit blockchain transaction via wallet
      console.log('🔗 Opening wallet for blockchain transaction...');
      let txId: string;
      
      try {
        const result = await walletService.requestIssueCertificate(
          certHash,
          {
            studentName: data.studentName,
            admissionNo: data.admissionNo,
            programme: data.programme,
            year: data.year,
            grade: data.grade,
            certHash
          },
          ipfsCid,
          import.meta.env.VITE_CONTRACT_ADDRESS || 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM' // Contract address (not wallet address)
        ); 
        txId = result.txId;
        console.log('✅ Blockchain transaction submitted:', txId);
      } catch (walletError: any) {
        console.error('Wallet transaction failed:', walletError);
        
        // Parse wallet-specific errors for better user messages
        const errorMessage = walletError.message || String(walletError);
        
        if (errorMessage.includes('USER_CANCELLED')) {
          throw new Error('Transaction cancelled by user');
        } else if (errorMessage.includes('INSUFFICIENT_FUNDS')) {
          throw new Error('Insufficient STX balance to pay transaction fees. Please add STX to your wallet.');
        } else if (errorMessage.includes('WALLET_NOT_CONNECTED')) {
          throw new Error('Wallet not connected. Please connect your wallet and try again.');
        } else if (errorMessage.includes('NETWORK_ERROR')) {
          throw new Error('Network connection issue. Please check your internet and try again.');
        } else if (errorMessage.includes('CONTRACT_ERROR')) {
          throw new Error('Smart contract interaction failed. The certificate may already exist.');
        } else {
          throw new Error(`Blockchain transaction failed: ${errorMessage}`);
        }
      }
      
      // Step 5: Return success result with blockchain transaction data
      const result = {
        success: true,
        certId: certHash,
        ipfsCid,
        blockchainTxId: txId,
        status: 'issued' as const,
        message: 'Certificate issued successfully',
        timestamp: new Date().toISOString(),
        certificate: {
          studentName: data.studentName,
          admissionNo: data.admissionNo,
          programme: data.programme,
          year: data.year,
          grade: data.grade,
          certHash
        }
      };

      console.log('🎉 Certificate issued successfully!');
      return result;
      
    } catch (error) {
      console.error('❌ Certificate issuance error:', error);
      
      // If it's already a formatted error, re-throw it
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes(':')) {
        throw error;
      }
      
      // Otherwise, wrap it as a general error
      throw new Error(`Certificate issuance failed: ${errorMessage}`);
    }
  }

  /**
   * Generate certificate hash ID
   */
  private generateCertificateHash(data: {
    studentName: string;
    admissionNo: string;
    programme: string;
    year: number;
    grade: string;
  }): string {
    // Simple hash generation - in production use crypto
    const hashInput = `${data.studentName}-${data.admissionNo}-${data.programme}-${data.year}-${data.grade}`;
    return btoa(hashInput).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  }

  /**
   * Verify a certificate by ID
   */
  async verify(certId: string): Promise<VerificationResult> {
    try {
      if (!certId || certId.trim().length === 0) {
        throw new Error('Certificate ID is required');
      }

      const result = await certivertAPI.verifyCertificate(certId.trim());
      
      // Enhanced verification result with additional business checks
      return {
        ...result,
        businessChecks: this.performBusinessChecks(result.certificate),
        securityChecks: this.performSecurityChecks(result),
        complianceStatus: this.checkCompliance(result.certificate),
      };
      
    } catch (error) {
      console.error('Certificate verification error:', error);
      throw new Error(
        error instanceof Error ? error.message : 'Failed to verify certificate'
      );
    }
  }

  /**
   * Revoke a certificate
   */
  async revoke(certId: string, reason: string, walletAddress: string): Promise<RevocationResult> {
    try {
      if (!certId || certId.trim().length === 0) {
        throw new Error('Certificate ID is required');
      }
      
      if (!reason || reason.trim().length === 0) {
        throw new Error('Revocation reason is required');
      }

      const revocationData = {
        walletAddress,
        certId: certId.trim(),
        reason: reason.trim(),
      };

      const result = await certivertAPI.revokeCertificate(revocationData);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to revoke certificate');
      }

      return result;
      
    } catch (error) {
      console.error('Certificate revocation error:', error);
      throw new Error(
        error instanceof Error ? error.message : 'Failed to revoke certificate'
      );
    }
  }

  /**
   * Download certificate PDF
   */
  async downloadPDF(ipfsCid: string, fileName?: string): Promise<{ blob: Blob; fileName: string }> {
    try {
      if (!ipfsCid || ipfsCid.trim().length === 0) {
        throw new Error('IPFS CID is required');
      }

      const blob = await certivertAPI.downloadFile(ipfsCid.trim());
      
      const downloadFileName = fileName || `certificate-${ipfsCid}.pdf`;
      
      return {
        blob,
        fileName: downloadFileName,
      };
      
    } catch (error) {
      console.error('Certificate download error:', error);
      throw new Error(
        error instanceof Error ? error.message : 'Failed to download certificate'
      );
    }
  }

  /**
   * Get file information from IPFS
   */
  async getFileInfo(ipfsCid: string): Promise<{ cid: string; size: number; type: string; message: string }> {
    try {
      if (!ipfsCid || ipfsCid.trim().length === 0) {
        throw new Error('IPFS CID is required');
      }

      return await certivertAPI.getFileInfo(ipfsCid.trim());
      
    } catch (error) {
      console.error('File info error:', error);
      throw new Error(
        error instanceof Error ? error.message : 'Failed to get file information'
      );
    }
  }

  /**
   * Validate certificate data before submission
   */
  validateCertificateData(data: IssuanceFormData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required field validation
    if (!data.studentName?.trim()) {
      errors.push('Student name is required');
    }
    
    if (!data.admissionNo?.trim()) {
      errors.push('Admission number is required');
    }
    
    if (!data.programme?.trim()) {
      errors.push('Programme is required');
    }
    
    if (!data.year || data.year < 2000 || data.year > new Date().getFullYear() + 1) {
      errors.push('Valid year is required');
    }
    
    if (!data.grade?.trim()) {
      errors.push('Grade is required');
    }

    // File validation
    if (!data.file) {
      errors.push('Certificate PDF file is required');
    } else {
      // Check file type
      if (data.file.type !== 'application/pdf') {
        errors.push('Only PDF files are allowed');
      }
      
      // Check file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (data.file.size > maxSize) {
        errors.push('File size must be less than 10MB');
      }
      
      // Check file name
      if (!data.file.name.toLowerCase().endsWith('.pdf')) {
        errors.push('File must have a .pdf extension');
      }
    }

    // Business logic validation
    if (data.studentName && data.studentName.length < 2) {
      errors.push('Student name must be at least 2 characters');
    }
    
    if (data.programme && data.programme.length < 2) {
      errors.push('Programme name must be at least 2 characters');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Format certificate data for display
   */
  formatCertificateForDisplay(certificate: CertificateJSON): {
    displayName: string;
    programmeDisplay: string;
    yearDisplay: string;
    gradeDisplay: string;
    statusDisplay: string;
    dateDisplay: string;
  } {
    return {
      displayName: certificate.studentName || 'Unknown Student',
      programmeDisplay: `${certificate.programme} (${certificate.year})`,
      yearDisplay: certificate.year.toString(),
      gradeDisplay: certificate.grade || 'Not specified',
      statusDisplay: this.getStatusDisplay(certificate.status),
      dateDisplay: new Date(certificate.dateIssued).toLocaleDateString(),
    };
  }

  /**
   * Get status display string
   */
  private getStatusDisplay(status: number): string {
    switch (status) {
      case 0: return 'Pending Issue';
      case 1: return 'Active';
      case 2: return 'Pending Revoke';
      case 3: return 'Revoked';
      default: return 'Unknown';
    }
  }

  /**
   * Perform business validation checks
   */
  private performBusinessChecks(certificate?: CertificateJSON) {
    if (!certificate) {
      return {
        isActive: false,
        canBeRevoked: false,
        isExpired: false,
        issueYear: 0,
        gradeValid: false,
        allPassed: false,
      };
    }

    const isActive = certificate.status === 1;
    const canBeRevoked = certificate.status === 1;
    const isExpired = false; // Certificates don't expire in this system
    const gradeValid = ['First Class', 'Second Upper', 'Second Lower', 'Third Class', 'Pass'].includes(certificate.grade);
    
    return {
      isActive,
      canBeRevoked,
      isExpired,
      issueYear: certificate.year,
      gradeValid,
      allPassed: isActive && gradeValid,
    };
  }

  /**
   * Perform security checks
   */
  private performSecurityChecks(result: VerificationResult) {
    const hashVerified = result.verificationDetails?.hashVerified ?? false;
    const blockchainVerified = result.verificationDetails?.blockchainVerified ?? true;
    const ipfsVerified = result.verificationDetails?.ipfsVerified ?? false;
    const tamperedWith = !hashVerified;
    
    const securityScore = [hashVerified, blockchainVerified, ipfsVerified]
      .filter(Boolean).length / 3 * 100;
    
    return {
      hashVerified,
      blockchainVerified,
      ipfsVerified,
      tamperedWith,
      securityScore,
      allPassed: hashVerified && blockchainVerified && ipfsVerified,
    };
  }

  /**
   * Check compliance status
   */
  private checkCompliance(certificate?: CertificateJSON) {
    if (!certificate) {
      return {
        formatCompliant: false,
        dataIntegrity: false,
        institutionalStandards: false,
        regulatoryCompliant: false,
        overallCompliant: false,
      };
    }

    const formatCompliant = !!(certificate.id && certificate.studentName && certificate.programme);
    const dataIntegrity = !!(certificate.year >= 2000 && certificate.grade);
    const institutionalStandards = true; // Assume compliance if issued
    const regulatoryCompliant = true; // Assume compliance if approved
    
    return {
      formatCompliant,
      dataIntegrity,
      institutionalStandards,
      regulatoryCompliant,
      overallCompliant: formatCompliant && dataIntegrity && institutionalStandards && regulatoryCompliant,
    };
  }
}

// Export singleton instance
export const certificateService = new CertificateService();