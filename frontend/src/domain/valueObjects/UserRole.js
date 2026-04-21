/**
 * User Role Value Object
 * Represents user roles in the Certivert system
 */

export class UserRole {
  static NONE = 0;
  static STUDENT = 1;
  static UNIVERSITY = 2;
  static KNQA = 3;
  static ADMIN = 4;

  static ROLE_NAMES = {
    [UserRole.NONE]: 'None',
    [UserRole.STUDENT]: 'Student',
    [UserRole.UNIVERSITY]: 'University',
    [UserRole.KNQA]: 'KNQA',
    [UserRole.ADMIN]: 'Administrator'
  };

  static ROLE_DESCRIPTIONS = {
    [UserRole.NONE]: 'No role assigned',
    [UserRole.STUDENT]: 'Academic certificate holder',
    [UserRole.UNIVERSITY]: 'Certificate issuing institution',
    [UserRole.KNQA]: 'Kenya National Qualifications Authority',
    [UserRole.ADMIN]: 'System administrator'
  };

  static ROLE_PERMISSIONS = {
    [UserRole.NONE]: [],
    [UserRole.STUDENT]: ['verify_certificate', 'view_own_certificates'],
    [UserRole.UNIVERSITY]: ['issue_certificate', 'revoke_certificate', 'verify_certificate', 'view_issued_certificates'],
    [UserRole.KNQA]: ['approve_certificate', 'revoke_certificate', 'verify_certificate', 'audit_system', 'view_all_certificates'],
    [UserRole.ADMIN]: ['*'] // All permissions
  };

  constructor(value) {
    // Handle both numeric and string role values
    const numericValue = typeof value === 'string' ? this.stringToNumeric(value) : value;
    
    if (!this.isValidRole(numericValue)) {
      throw new Error(`Invalid user role: ${value}`);
    }
    this._value = numericValue;
  }

  get value() {
    return this._value;
  }

  /**
   * Role type checks
   */
  isNone() {
    return this._value === UserRole.NONE;
  }

  isStudent() {
    return this._value === UserRole.STUDENT;
  }

  isUniversity() {
    return this._value === UserRole.UNIVERSITY;
  }

  isKNQA() {
    return this._value === UserRole.KNQA;
  }

  isAdmin() {
    return this._value === UserRole.ADMIN;
  }

  /**
   * Permission checking
   */
  hasPermission(permission) {
    const rolePermissions = UserRole.ROLE_PERMISSIONS[this._value] || [];
    
    // Admin has all permissions
    if (rolePermissions.includes('*')) {
      return true;
    }
    
    return rolePermissions.includes(permission);
  }

  getPermissions() {
    return UserRole.ROLE_PERMISSIONS[this._value] || [];
  }

  /**
   * Display methods
   */
  getDisplayName() {
    return UserRole.ROLE_NAMES[this._value] || 'Unknown';
  }

  getDescription() {
    return UserRole.ROLE_DESCRIPTIONS[this._value] || 'Unknown role';
  }

  /**
   * Role hierarchy
   */
  getLevel() {
    const hierarchy = {
      [UserRole.NONE]: 0,
      [UserRole.STUDENT]: 1,
      [UserRole.UNIVERSITY]: 2,
      [UserRole.KNQA]: 3,
      [UserRole.ADMIN]: 4
    };
    return hierarchy[this._value] || 0;
  }

  isHigherThan(otherRole) {
    const other = otherRole instanceof UserRole ? otherRole : new UserRole(otherRole);
    return this.getLevel() > other.getLevel();
  }

  /**
   * Validation
   */
  isValidRole(value) {
    return Object.values({
      NONE: UserRole.NONE,
      STUDENT: UserRole.STUDENT,
      UNIVERSITY: UserRole.UNIVERSITY,
      KNQA: UserRole.KNQA,
      ADMIN: UserRole.ADMIN
    }).includes(value);
  }

  isValid() {
    return this.isValidRole(this._value);
  }

  /**
   * String conversion helpers
   */
  stringToNumeric(roleString) {
    const mapping = {
      'none': UserRole.NONE,
      'student': UserRole.STUDENT,
      'university': UserRole.UNIVERSITY,
      'knqa': UserRole.KNQA,
      'admin': UserRole.ADMIN
    };
    return mapping[roleString.toLowerCase()];
  }

  toStringValue() {
    const mapping = {
      [UserRole.NONE]: 'none',
      [UserRole.STUDENT]: 'student',
      [UserRole.UNIVERSITY]: 'university',
      [UserRole.KNQA]: 'knqa',
      [UserRole.ADMIN]: 'admin'
    };
    return mapping[this._value] || 'none';
  }

  /**
   * Factory methods
   */
  static none() {
    return new UserRole(UserRole.NONE);
  }

  static student() {
    return new UserRole(UserRole.STUDENT);
  }

  static university() {
    return new UserRole(UserRole.UNIVERSITY);
  }

  static knqa() {
    return new UserRole(UserRole.KNQA);
  }

  static admin() {
    return new UserRole(UserRole.ADMIN);
  }

  static fromString(roleString) {
    return new UserRole(roleString);
  }

  /**
   * Comparison
   */
  equals(other) {
    return other instanceof UserRole && this._value === other._value;
  }

  /**
   * Serialization
   */
  toString() {
    return this.getDisplayName();
  }

  toJSON() {
    return this._value;
  }

  /**
   * Static helpers
   */
  static getAllRoles() {
    return [
      UserRole.NONE,
      UserRole.STUDENT,
      UserRole.UNIVERSITY,
      UserRole.KNQA,
      UserRole.ADMIN
    ];
  }

  static getRoleChoices() {
    return UserRole.getAllRoles().map(role => ({
      value: role,
      label: UserRole.ROLE_NAMES[role],
      description: UserRole.ROLE_DESCRIPTIONS[role]
    }));
  }
}