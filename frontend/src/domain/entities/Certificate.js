/**
 * Certificate Domain Entity
 * Represents the core business entity for academic certificates
 */

import { CertificateId } from '../valueObjects/CertificateId.js';
import { StudentInfo } from '../valueObjects/StudentInfo.js';
import { CertificateStatus } from '../valueObjects/CertificateStatus.js';

export class Certificate {
  constructor({
    id,
    studentInfo,
    programme,
    year,
    grade,
    ipfsCid,
    status,
    issuedAt = null,
    revokedAt = null,
    revocationReason = null,
    universityPrincipal = null,
    knqaPrincipal = null
  }) {
    this.id = id instanceof CertificateId ? id : new CertificateId(id);
    this.studentInfo = studentInfo instanceof StudentInfo ? studentInfo : new StudentInfo(studentInfo);
    this.programme = programme;
    this.year = year;
    this.grade = grade;
    this.ipfsCid = ipfsCid;
    this.status = status instanceof CertificateStatus ? status : new CertificateStatus(status);
    this.issuedAt = issuedAt;
    this.revokedAt = revokedAt;
    this.revocationReason = revocationReason;
    this.universityPrincipal = universityPrincipal;
    this.knqaPrincipal = knqaPrincipal;
  }

  /**
   * Business logic methods
   */
  isActive() {
    return this.status.isActive();
  }

  isRevoked() {
    return this.status.isRevoked();
  }

  isPending() {
    return this.status.isPending();
  }

  canBeRevoked() {
    return this.isActive() && !this.isRevoked();
  }

  revoke(reason) {
    if (!this.canBeRevoked()) {
      throw new Error('Certificate cannot be revoked in its current state');
    }
    
    return new Certificate({
      ...this,
      status: CertificateStatus.REVOKED,
      revokedAt: new Date(),
      revocationReason: reason
    });
  }

  activate() {
    if (!this.status.isPendingIssue()) {
      throw new Error('Certificate can only be activated from pending state');
    }

    return new Certificate({
      ...this,
      status: CertificateStatus.ACTIVE,
      issuedAt: new Date()
    });
  }

  /**
   * Validation methods
   */
  validate() {
    const errors = [];

    if (!this.id || !this.id.isValid()) {
      errors.push('Invalid certificate ID');
    }

    if (!this.studentInfo || !this.studentInfo.isValid()) {
      errors.push('Invalid student information');
    }

    if (!this.programme || this.programme.trim().length === 0) {
      errors.push('Programme is required');
    }

    if (!this.year || this.year < 1900 || this.year > new Date().getFullYear() + 10) {
      errors.push('Invalid graduation year');
    }

    if (!this.grade || this.grade.trim().length === 0) {
      errors.push('Grade is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Serialization methods
   */
  toJSON() {
    return {
      id: this.id.value,
      studentInfo: this.studentInfo.toJSON(),
      programme: this.programme,
      year: this.year,
      grade: this.grade,
      ipfsCid: this.ipfsCid,
      status: this.status.value,
      issuedAt: this.issuedAt,
      revokedAt: this.revokedAt,
      revocationReason: this.revocationReason,
      universityPrincipal: this.universityPrincipal,
      knqaPrincipal: this.knqaPrincipal
    };
  }

  static fromJSON(data) {
    return new Certificate({
      id: data.id,
      studentInfo: data.studentInfo,
      programme: data.programme,
      year: data.year,
      grade: data.grade,
      ipfsCid: data.ipfsCid,
      status: data.status,
      issuedAt: data.issuedAt ? new Date(data.issuedAt) : null,
      revokedAt: data.revokedAt ? new Date(data.revokedAt) : null,
      revocationReason: data.revocationReason,
      universityPrincipal: data.universityPrincipal,
      knqaPrincipal: data.knqaPrincipal
    });
  }
}