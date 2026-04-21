/**
 * Certificate ID Value Object
 * Represents a unique certificate identifier (SHA-256 hash)
 */

export class CertificateId {
  constructor(value) {
    if (typeof value !== 'string') {
      throw new Error('Certificate ID must be a string');
    }
    
    this._value = value.toLowerCase();
    
    if (!this.isValid()) {
      throw new Error(`Invalid certificate ID format: ${value}`);
    }
  }

  get value() {
    return this._value;
  }

  /**
   * Validation
   */
  isValid() {
    // SHA-256 hash is 64 characters of hexadecimal
    const sha256Regex = /^[a-f0-9]{64}$/;
    return sha256Regex.test(this._value);
  }

  /**
   * Display methods
   */
  truncated(length = 8) {
    if (length < 4) length = 4;
    return `${this._value.slice(0, length)}...${this._value.slice(-4)}`;
  }

  /**
   * Comparison
   */
  equals(other) {
    return other instanceof CertificateId && this._value === other._value;
  }

  /**
   * String representation
   */
  toString() {
    return this._value;
  }

  toJSON() {
    return this._value;
  }

  /**
   * Static factory methods
   */
  static fromHash(hash) {
    return new CertificateId(hash);
  }

  static generate(certificateData) {
    // This would typically use a hashing function
    // For now, we'll throw an error as this should be done server-side
    throw new Error('Certificate ID generation must be done server-side');
  }

  /**
   * Validation helper
   */
  static isValidFormat(value) {
    try {
      new CertificateId(value);
      return true;
    } catch {
      return false;
    }
  }
}