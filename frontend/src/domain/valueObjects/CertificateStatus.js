/**
 * Certificate Status Value Object
 * Represents the current status of a certificate in the system
 */

export class CertificateStatus {
  static PENDING_ISSUE = 100;
  static ACTIVE = 200;
  static PENDING_REVOKE = 300;
  static REVOKED = 400;

  static STATUS_NAMES = {
    [CertificateStatus.PENDING_ISSUE]: 'Pending Issue',
    [CertificateStatus.ACTIVE]: 'Active',
    [CertificateStatus.PENDING_REVOKE]: 'Pending Revocation',
    [CertificateStatus.REVOKED]: 'Revoked'
  };

  static STATUS_COLORS = {
    [CertificateStatus.PENDING_ISSUE]: 'orange',
    [CertificateStatus.ACTIVE]: 'green',
    [CertificateStatus.PENDING_REVOKE]: 'yellow',
    [CertificateStatus.REVOKED]: 'red'
  };

  constructor(value) {
    if (!this.isValidStatus(value)) {
      throw new Error(`Invalid certificate status: ${value}`);
    }
    this._value = value;
  }

  get value() {
    return this._value;
  }

  /**
   * Status check methods
   */
  isPendingIssue() {
    return this._value === CertificateStatus.PENDING_ISSUE;
  }

  isActive() {
    return this._value === CertificateStatus.ACTIVE;
  }

  isPendingRevoke() {
    return this._value === CertificateStatus.PENDING_REVOKE;
  }

  isRevoked() {
    return this._value === CertificateStatus.REVOKED;
  }

  isPending() {
    return this.isPendingIssue() || this.isPendingRevoke();
  }

  /**
   * Display methods
   */
  getDisplayName() {
    return CertificateStatus.STATUS_NAMES[this._value] || 'Unknown';
  }

  getColor() {
    return CertificateStatus.STATUS_COLORS[this._value] || 'gray';
  }

  /**
   * Validation
   */
  isValidStatus(value) {
    return Object.values({
      PENDING_ISSUE: CertificateStatus.PENDING_ISSUE,
      ACTIVE: CertificateStatus.ACTIVE,
      PENDING_REVOKE: CertificateStatus.PENDING_REVOKE,
      REVOKED: CertificateStatus.REVOKED
    }).includes(value);
  }

  /**
   * State transitions
   */
  canTransitionTo(newStatus) {
    const transitions = {
      [CertificateStatus.PENDING_ISSUE]: [CertificateStatus.ACTIVE],
      [CertificateStatus.ACTIVE]: [CertificateStatus.PENDING_REVOKE, CertificateStatus.REVOKED],
      [CertificateStatus.PENDING_REVOKE]: [CertificateStatus.REVOKED, CertificateStatus.ACTIVE],
      [CertificateStatus.REVOKED]: [] // Final state
    };

    return transitions[this._value]?.includes(newStatus) || false;
  }

  /**
   * Factory methods
   */
  static pendingIssue() {
    return new CertificateStatus(CertificateStatus.PENDING_ISSUE);
  }

  static active() {
    return new CertificateStatus(CertificateStatus.ACTIVE);
  }

  static pendingRevoke() {
    return new CertificateStatus(CertificateStatus.PENDING_REVOKE);
  }

  static revoked() {
    return new CertificateStatus(CertificateStatus.REVOKED);
  }

  /**
   * Comparison
   */
  equals(other) {
    return other instanceof CertificateStatus && this._value === other._value;
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
  static getAllStatuses() {
    return [
      CertificateStatus.PENDING_ISSUE,
      CertificateStatus.ACTIVE,
      CertificateStatus.PENDING_REVOKE,
      CertificateStatus.REVOKED
    ];
  }

  static fromValue(value) {
    return new CertificateStatus(value);
  }
}