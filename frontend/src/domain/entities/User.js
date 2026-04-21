/**
 * User Domain Entity
 * Represents users in the Certivert system (Students, Universities, KNQA)
 */

import { WalletAddress } from '../valueObjects/WalletAddress.js';
import { UserRole } from '../valueObjects/UserRole.js';

export class User {
  constructor({
    address,
    role,
    publicKey = null,
    name = null,
    email = null,
    institution = null,
    isConnected = false,
    lastLoginAt = null
  }) {
    this.address = address instanceof WalletAddress ? address : new WalletAddress(address);
    this.role = role instanceof UserRole ? role : new UserRole(role);
    this.publicKey = publicKey;
    this.name = name;
    this.email = email;
    this.institution = institution;
    this.isConnected = isConnected;
    this.lastLoginAt = lastLoginAt;
  }

  /**
   * Business logic methods
   */
  isStudent() {
    return this.role.isStudent();
  }

  isUniversity() {
    return this.role.isUniversity();
  }

  isKNQA() {
    return this.role.isKNQA();
  }

  isAdmin() {
    return this.role.isAdmin();
  }

  canIssueCertificates() {
    return this.isUniversity();
  }

  canApproveCertificates() {
    return this.isKNQA();
  }

  canRevokeCertificates() {
    return this.isUniversity() || this.isKNQA();
  }

  canViewAllCertificates() {
    return this.isKNQA() || this.isAdmin();
  }

  canAuditSystem() {
    return this.isKNQA();
  }

  connect(publicKey) {
    return new User({
      ...this,
      publicKey,
      isConnected: true,
      lastLoginAt: new Date()
    });
  }

  disconnect() {
    return new User({
      ...this,
      isConnected: false
    });
  }

  updateProfile({ name, email, institution }) {
    return new User({
      ...this,
      name: name ?? this.name,
      email: email ?? this.email,
      institution: institution ?? this.institution
    });
  }

  /**
   * Authorization helpers
   */
  hasPermission(action) {
    const permissions = {
      'issue_certificate': this.canIssueCertificates(),
      'approve_certificate': this.canApproveCertificates(),
      'revoke_certificate': this.canRevokeCertificates(),
      'view_all_certificates': this.canViewAllCertificates(),
      'audit_system': this.canAuditSystem(),
      'verify_certificate': true // All users can verify
    };

    return permissions[action] || false;
  }

  /**
   * Validation methods
   */
  validate() {
    const errors = [];

    if (!this.address || !this.address.isValid()) {
      errors.push('Invalid wallet address');
    }

    if (!this.role || !this.role.isValid()) {
      errors.push('Invalid user role');
    }

    if (this.email && !this.isValidEmail(this.email)) {
      errors.push('Invalid email format');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Display helpers
   */
  getDisplayName() {
    return this.name || this.address.truncated();
  }

  getRoleDisplayName() {
    return this.role.getDisplayName();
  }

  /**
   * Serialization methods
   */
  toJSON() {
    return {
      address: this.address.value,
      role: this.role.value,
      publicKey: this.publicKey,
      name: this.name,
      email: this.email,
      institution: this.institution,
      isConnected: this.isConnected,
      lastLoginAt: this.lastLoginAt
    };
  }

  static fromJSON(data) {
    return new User({
      address: data.address,
      role: data.role,
      publicKey: data.publicKey,
      name: data.name,
      email: data.email,
      institution: data.institution,
      isConnected: data.isConnected,
      lastLoginAt: data.lastLoginAt ? new Date(data.lastLoginAt) : null
    });
  }

  /**
   * Factory methods
   */
  static createStudent(address, name = null) {
    return new User({
      address,
      role: UserRole.STUDENT,
      name
    });
  }

  static createUniversity(address, institution) {
    return new User({
      address,
      role: UserRole.UNIVERSITY,
      institution
    });
  }

  static createKNQA(address) {
    return new User({
      address,
      role: UserRole.KNQA,
      institution: 'Kenya National Qualifications Authority'
    });
  }
}