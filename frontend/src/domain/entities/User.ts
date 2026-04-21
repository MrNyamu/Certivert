/**
 * User Domain Entity (TypeScript)
 * Core business entity representing a system user with role-based permissions
 */

import { WalletAddress } from '../valueObjects/WalletAddress.js';
import { UserRole } from '../valueObjects/UserRole.js';
import type { 
  IUser, 
  UserJSON, 
  UserRoleType 
} from '../../types/index.js';

/**
 * User Entity
 * Represents a user in the certificate management system
 */
export class User implements IUser {
  public readonly address: WalletAddress;
  public readonly role: UserRole;
  public readonly name?: string;
  public readonly email?: string;
  public readonly institution?: string;
  public readonly publicKey?: string;
  public readonly isConnected: boolean;
  public readonly lastLoginAt?: Date;

  constructor(params: {
    address: WalletAddress | string;
    role: UserRole | number;
    name?: string;
    email?: string;
    institution?: string;
    publicKey?: string;
    isConnected?: boolean;
    lastLoginAt?: Date | string;
  }) {
    // Ensure address is a proper WalletAddress value object
    this.address = params.address instanceof WalletAddress 
      ? params.address 
      : new WalletAddress(params.address);
    
    // Ensure role is a proper UserRole value object
    this.role = params.role instanceof UserRole 
      ? params.role 
      : new UserRole(params.role);
    
    this.name = params.name?.trim();
    this.email = params.email?.trim().toLowerCase();
    this.institution = params.institution?.trim();
    this.publicKey = params.publicKey;
    this.isConnected = params.isConnected ?? false;
    this.lastLoginAt = typeof params.lastLoginAt === 'string'
      ? new Date(params.lastLoginAt)
      : params.lastLoginAt;

    // Freeze object for immutability
    Object.freeze(this);
  }

  /**
   * Check if user is a student
   */
  isStudent(): boolean {
    return this.role.value === UserRole.STUDENT;
  }

  /**
   * Check if user is a university
   */
  isUniversity(): boolean {
    return this.role.value === UserRole.UNIVERSITY;
  }

  /**
   * Check if user is KNQA
   */
  isKNQA(): boolean {
    return this.role.value === UserRole.KNQA;
  }

  /**
   * Check if user account is active
   */
  isActive(): boolean {
    return this.role.value > UserRole.NONE && this.isConnected;
  }

  /**
   * Check if user can issue certificates
   */
  canIssueCertificates(): boolean {
    return this.role.canIssue();
  }

  /**
   * Check if user can approve certificates
   */
  canApproveCertificates(): boolean {
    return this.role.canApprove();
  }

  /**
   * Check if user can revoke certificates
   */
  canRevokeCertificates(): boolean {
    return this.role.canRevoke();
  }

  /**
   * Check if user has specific permission
   */
  hasPermission(permission: string): boolean {
    const permissions = this.role.getPermissions();
    return permissions.includes(permission);
  }

  /**
   * Get user display name
   */
  getDisplayName(): string {
    if (this.name && this.name.trim().length > 0) {
      return this.name.trim();
    }

    if (this.email && this.email.trim().length > 0) {
      return this.email.split('@')[0];
    }

    // Fallback to abbreviated address
    const addr = this.address.value;
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  }

  /**
   * Get user full display information
   */
  getDisplayInfo(): {
    displayName: string;
    role: string;
    address: string;
    institution?: string;
    contactInfo?: string;
  } {
    return {
      displayName: this.getDisplayName(),
      role: this.role.toStringValue(),
      address: this.address.value,
      institution: this.institution,
      contactInfo: this.email || 'No contact information'
    };
  }

  /**
   * Check if user profile is complete
   */
  isProfileComplete(): boolean {
    const hasBasicInfo = Boolean(this.name && this.email);
    
    // Additional requirements based on role
    if (this.isUniversity() || this.isKNQA()) {
      return hasBasicInfo && Boolean(this.institution);
    }

    return hasBasicInfo;
  }

  /**
   * Get profile completion percentage
   */
  getProfileCompletionPercentage(): number {
    let completed = 0;
    const total = this.isUniversity() || this.isKNQA() ? 4 : 3; // institution required for universities and KNQA

    if (this.name) completed++;
    if (this.email) completed++;
    if (this.address.isValid()) completed++;
    if ((this.isUniversity() || this.isKNQA()) && this.institution) completed++;
    if (!this.isUniversity() && !this.isKNQA()) completed++; // institution not required for students

    return Math.round((completed / total) * 100);
  }

  /**
   * Check if user can access specific dashboard features
   */
  canAccessFeature(feature: string): boolean {
    switch (feature) {
      case 'issue_certificates':
        return this.canIssueCertificates();
      case 'approve_certificates':
        return this.canApproveCertificates();
      case 'revoke_certificates':
        return this.canRevokeCertificates();
      case 'view_own_certificates':
        return this.isStudent();
      case 'audit_system':
        return this.isKNQA();
      case 'manage_universities':
        return this.isKNQA();
      case 'verify_certificates':
        return true; // Everyone can verify certificates
      case 'download_certificates':
        return this.isStudent() || this.isUniversity() || this.isKNQA();
      case 'system_statistics':
        return this.isKNQA();
      default:
        return false;
    }
  }

  /**
   * Get available dashboard features for this user
   */
  getAvailableFeatures(): string[] {
    const features: string[] = ['verify_certificates']; // Base feature for everyone

    if (this.isStudent()) {
      features.push('view_own_certificates', 'download_certificates');
    }

    if (this.isUniversity()) {
      features.push(
        'issue_certificates',
        'revoke_certificates',
        'download_certificates'
      );
    }

    if (this.isKNQA()) {
      features.push(
        'approve_certificates',
        'revoke_certificates',
        'audit_system',
        'manage_universities',
        'system_statistics',
        'download_certificates'
      );
    }

    return features;
  }

  /**
   * Check session validity
   */
  isSessionValid(): boolean {
    if (!this.isConnected || !this.lastLoginAt) {
      return false;
    }

    // Check if session is older than 24 hours
    const sessionAge = Date.now() - this.lastLoginAt.getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    return sessionAge < maxAge;
  }

  /**
   * Get session time remaining in minutes
   */
  getSessionTimeRemaining(): number {
    if (!this.isSessionValid()) {
      return 0;
    }

    const sessionAge = Date.now() - (this.lastLoginAt?.getTime() || 0);
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const remaining = maxAge - sessionAge;

    return Math.max(0, Math.floor(remaining / (60 * 1000))); // Convert to minutes
  }

  /**
   * Check if user email is verified
   */
  isEmailVerified(): boolean {
    // In a real implementation, this would check email verification status
    // For now, we assume email is verified if it exists
    return Boolean(this.email);
  }

  /**
   * Get user permissions as an object
   */
  getPermissionObject(): Record<string, boolean> {
    return {
      canIssue: this.canIssueCertificates(),
      canApprove: this.canApproveCertificates(),
      canRevoke: this.canRevokeCertificates(),
      canAudit: this.isKNQA(),
      canManage: this.isKNQA(),
      canView: this.isActive(),
      canVerify: true
    };
  }

  /**
   * Create a copy with updated information
   */
  withUpdatedInfo(updates: {
    name?: string;
    email?: string;
    institution?: string;
    isConnected?: boolean;
    lastLoginAt?: Date;
  }): User {
    return new User({
      address: this.address,
      role: this.role,
      name: updates.name ?? this.name,
      email: updates.email ?? this.email,
      institution: updates.institution ?? this.institution,
      publicKey: this.publicKey,
      isConnected: updates.isConnected ?? this.isConnected,
      lastLoginAt: updates.lastLoginAt ?? this.lastLoginAt
    });
  }

  /**
   * Create a copy with connected state
   */
  withConnectionState(isConnected: boolean, lastLoginAt?: Date): User {
    return new User({
      address: this.address,
      role: this.role,
      name: this.name,
      email: this.email,
      institution: this.institution,
      publicKey: this.publicKey,
      isConnected,
      lastLoginAt: lastLoginAt || (isConnected ? new Date() : this.lastLoginAt)
    });
  }

  /**
   * Convert to JSON representation
   */
  toJSON(): UserJSON {
    return {
      address: this.address.value,
      role: this.role.value,
      name: this.name,
      email: this.email,
      institution: this.institution,
      publicKey: this.publicKey,
      isConnected: this.isConnected,
      lastLoginAt: this.lastLoginAt?.toISOString()
    };
  }

  /**
   * Create User from JSON data
   */
  static fromJSON(data: UserJSON | Record<string, any>): User {
    return new User({
      address: data.address,
      role: data.role,
      name: data.name,
      email: data.email,
      institution: data.institution,
      publicKey: data.publicKey,
      isConnected: data.isConnected ?? false,
      lastLoginAt: data.lastLoginAt
    });
  }

  /**
   * Create anonymous user (for public access)
   */
  static createAnonymous(): User {
    return new User({
      address: 'anonymous',
      role: UserRole.NONE,
      isConnected: false
    });
  }

  /**
   * Create user template for specific role
   */
  static createTemplate(address: string, roleType: UserRoleType): User {
    const roleMap = {
      'none': UserRole.NONE,
      'student': UserRole.STUDENT,
      'university': UserRole.UNIVERSITY,
      'knqa': UserRole.KNQA
    };

    return new User({
      address,
      role: roleMap[roleType] ?? UserRole.NONE,
      isConnected: false
    });
  }

  /**
   * Validate user data
   */
  static validateUserData(data: Record<string, any>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate address
    try {
      const address = new WalletAddress(data.address);
      if (!address.isValid()) {
        errors.push('Invalid wallet address format');
      }
    } catch {
      errors.push('Invalid or missing wallet address');
    }

    // Validate role
    if (typeof data.role !== 'number' || data.role < 0 || data.role > 3) {
      errors.push('Invalid user role');
    }

    // Validate email format if provided
    if (data.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        errors.push('Invalid email format');
      }
    }

    // Validate name length if provided
    if (data.name && data.name.trim().length < 2) {
      errors.push('Name is too short');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Compare two users for equality
   */
  equals(other: User): boolean {
    return this.address.value === other.address.value;
  }

  /**
   * Get hash code for this user
   */
  hashCode(): number {
    return this.address.value.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
  }

  /**
   * String representation of user
   */
  toString(): string {
    return `User(${this.address.value}, ${this.role.toStringValue()}, ${this.getDisplayName()})`;
  }
}

export default User;