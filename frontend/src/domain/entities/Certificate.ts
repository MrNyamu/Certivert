/**
 * Certificate Domain Entity (TypeScript)
 * Core business entity representing an academic certificate
 */

import { CertificateId } from '../valueObjects/CertificateId.js';
import { CertificateStatus } from '../valueObjects/CertificateStatus.js';
import { StudentInfo } from '../valueObjects/StudentInfo.js';
import type { 
  ICertificate, 
  CertificateJSON, 
  ValidationResult 
} from '../../types/index.js';

/**
 * Certificate Entity
 * Represents an immutable certificate with business logic
 */
export class Certificate implements ICertificate {
  public readonly id: CertificateId;
  public readonly studentInfo: StudentInfo;
  public readonly programme: string;
  public readonly year: number;
  public readonly grade: string;
  public readonly issuerAddress: string;
  public readonly dateIssued: Date;
  public readonly status: CertificateStatus;
  public readonly ipfsCid?: string;
  public readonly additionalData?: Record<string, any>;

  constructor(params: {
    id: CertificateId | string;
    studentInfo: StudentInfo | Record<string, any>;
    programme: string;
    year: number;
    grade: string;
    issuerAddress: string;
    dateIssued: Date | string;
    status: CertificateStatus | number;
    ipfsCid?: string;
    additionalData?: Record<string, any>;
  }) {
    // Ensure all properties are proper value objects/entities
    this.id = params.id instanceof CertificateId ? params.id : new CertificateId(params.id);
    this.studentInfo = params.studentInfo instanceof StudentInfo 
      ? params.studentInfo 
      : new StudentInfo(params.studentInfo);
    
    this.programme = params.programme;
    this.year = params.year;
    this.grade = params.grade;
    this.issuerAddress = params.issuerAddress;
    this.dateIssued = typeof params.dateIssued === 'string' 
      ? new Date(params.dateIssued) 
      : params.dateIssued;
    
    this.status = params.status instanceof CertificateStatus
      ? params.status
      : new CertificateStatus(params.status);
    
    this.ipfsCid = params.ipfsCid;
    this.additionalData = params.additionalData;

    // Freeze the object to ensure immutability
    Object.freeze(this);
  }

  /**
   * Check if certificate is currently active
   */
  isActive(): boolean {
    return this.status.isActive();
  }

  /**
   * Check if certificate can be revoked
   */
  canBeRevoked(): boolean {
    return this.status.isActive() && !this.status.isPending();
  }

  /**
   * Validate certificate data integrity
   */
  validate(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate ID
    if (!this.id.isValid()) {
      errors.push('Invalid certificate ID format');
    }

    // Validate student info
    const studentValidation = this.studentInfo.isValid();
    if (!studentValidation) {
      errors.push('Invalid student information');
    }

    // Validate programme
    if (!this.programme || this.programme.trim().length === 0) {
      errors.push('Programme is required');
    } else if (this.programme.length < 3) {
      errors.push('Programme name is too short');
    }

    // Validate year
    const currentYear = new Date().getFullYear();
    if (this.year < 1950) {
      errors.push('Certificate year is too old');
    } else if (this.year > currentYear) {
      errors.push('Certificate year cannot be in the future');
    } else if (this.year > currentYear - 2) {
      warnings.push('Very recent graduation year');
    }

    // Validate grade
    const validGrades = ['A', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'];
    if (!validGrades.includes(this.grade)) {
      errors.push(`Invalid grade: ${this.grade}`);
    }

    // Validate issuer address (basic format check)
    if (!this.issuerAddress || this.issuerAddress.length < 20) {
      errors.push('Invalid issuer address');
    }

    // Validate date issued
    if (this.dateIssued > new Date()) {
      errors.push('Issue date cannot be in the future');
    }

    const certificateAge = Date.now() - this.dateIssued.getTime();
    const maxAge = 50 * 365 * 24 * 60 * 60 * 1000; // 50 years in milliseconds
    if (certificateAge > maxAge) {
      warnings.push('Certificate is very old');
    }

    // Check data consistency
    const academicYearEnd = new Date(this.year, 11, 31); // December 31st of graduation year
    const maxValidIssueDate = new Date(this.year + 2, 11, 31); // Up to 2 years after graduation
    
    if (this.dateIssued < new Date(this.year - 1, 0, 1)) {
      errors.push('Issue date is too early for the graduation year');
    } else if (this.dateIssued > maxValidIssueDate) {
      errors.push('Issue date is too late for the graduation year');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get certificate age in years
   */
  getAge(): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - this.dateIssued.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24 * 365));
  }

  /**
   * Get formatted display information
   */
  getDisplayInfo(): {
    title: string;
    subtitle: string;
    summary: string;
    details: Record<string, string>;
  } {
    return {
      title: `${this.programme} Certificate`,
      subtitle: `${this.studentInfo.studentName} - ${this.year}`,
      summary: `${this.programme} (${this.year}) - Grade: ${this.grade}`,
      details: {
        'Student Name': this.studentInfo.studentName,
        'Admission No': this.studentInfo.admissionNo,
        'Programme': this.programme,
        'Year': this.year.toString(),
        'Grade': this.grade,
        'Date Issued': this.dateIssued.toLocaleDateString(),
        'Status': this.status.toString(),
        'Certificate ID': this.id.value.substring(0, 16) + '...'
      }
    };
  }

  /**
   * Check if this certificate belongs to a specific student
   */
  belongsToStudent(admissionNo: string): boolean {
    return this.studentInfo.admissionNo.toLowerCase() === admissionNo.toLowerCase();
  }

  /**
   * Check if certificate was issued by specific issuer
   */
  isIssuedBy(issuerAddress: string): boolean {
    return this.issuerAddress.toLowerCase() === issuerAddress.toLowerCase();
  }

  /**
   * Create a copy with updated status
   */
  withStatus(newStatus: CertificateStatus | number): Certificate {
    return new Certificate({
      ...this.toConstructorParams(),
      status: newStatus
    });
  }

  /**
   * Create a copy with additional metadata
   */
  withAdditionalData(additionalData: Record<string, any>): Certificate {
    return new Certificate({
      ...this.toConstructorParams(),
      additionalData: { ...this.additionalData, ...additionalData }
    });
  }

  /**
   * Convert to JSON representation
   */
  toJSON(): CertificateJSON {
    return {
      id: this.id.value,
      studentName: this.studentInfo.studentName,
      admissionNo: this.studentInfo.admissionNo,
      programme: this.programme,
      year: this.year,
      grade: this.grade,
      issuerAddress: this.issuerAddress,
      dateIssued: this.dateIssued.toISOString(),
      status: this.status.value,
      ipfsCid: this.ipfsCid,
      additionalData: this.additionalData
    };
  }

  /**
   * Get constructor parameters for copying
   */
  private toConstructorParams(): {
    id: CertificateId;
    studentInfo: StudentInfo;
    programme: string;
    year: number;
    grade: string;
    issuerAddress: string;
    dateIssued: Date;
    status: CertificateStatus;
    ipfsCid?: string;
    additionalData?: Record<string, any>;
  } {
    return {
      id: this.id,
      studentInfo: this.studentInfo,
      programme: this.programme,
      year: this.year,
      grade: this.grade,
      issuerAddress: this.issuerAddress,
      dateIssued: this.dateIssued,
      status: this.status,
      ipfsCid: this.ipfsCid,
      additionalData: this.additionalData
    };
  }

  /**
   * Create Certificate from JSON data
   */
  static fromJSON(data: CertificateJSON | Record<string, any>): Certificate {
    return new Certificate({
      id: data.id,
      studentInfo: {
        studentName: data.studentName,
        admissionNo: data.admissionNo,
        programme: data.programme,
        year: data.year,
        grade: data.grade
      },
      programme: data.programme,
      year: data.year,
      grade: data.grade,
      issuerAddress: data.issuerAddress,
      dateIssued: data.dateIssued,
      status: data.status,
      ipfsCid: data.ipfsCid,
      additionalData: data.additionalData
    });
  }

  /**
   * Create empty certificate template
   */
  static createTemplate(params: {
    studentInfo: StudentInfo | Record<string, any>;
    programme: string;
    year: number;
    grade: string;
    issuerAddress: string;
  }): Certificate {
    // Generate a temporary ID based on content
    const tempId = Certificate.generateContentBasedId({
      studentInfo: params.studentInfo,
      programme: params.programme,
      year: params.year,
      grade: params.grade
    });

    return new Certificate({
      id: tempId,
      studentInfo: params.studentInfo,
      programme: params.programme,
      year: params.year,
      grade: params.grade,
      issuerAddress: params.issuerAddress,
      dateIssued: new Date(),
      status: CertificateStatus.PENDING_ISSUE
    });
  }

  /**
   * Generate content-based certificate ID
   */
  static generateContentBasedId(content: {
    studentInfo: StudentInfo | Record<string, any>;
    programme: string;
    year: number;
    grade: string;
  }): string {
    const studentInfo = content.studentInfo instanceof StudentInfo 
      ? content.studentInfo 
      : new StudentInfo(content.studentInfo);

    const contentString = JSON.stringify({
      studentName: studentInfo.studentName,
      admissionNo: studentInfo.admissionNo,
      programme: content.programme,
      year: content.year,
      grade: content.grade
    });

    // Simple hash (in production, use proper cryptographic hash)
    let hash = 0;
    for (let i = 0; i < contentString.length; i++) {
      const char = contentString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(16).padStart(64, '0');
  }

  /**
   * Compare two certificates for equality
   */
  equals(other: Certificate): boolean {
    return this.id.value === other.id.value;
  }

  /**
   * Get hash code for this certificate
   */
  hashCode(): number {
    return this.id.value.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
  }

  /**
   * String representation of certificate
   */
  toString(): string {
    return `Certificate(${this.id.value.substring(0, 8)}..., ${this.studentInfo.studentName}, ${this.programme} ${this.year})`;
  }
}

export default Certificate;