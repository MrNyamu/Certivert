/**
 * Wallet Address Value Object
 * Represents a Stacks blockchain wallet address
 */

export class WalletAddress {
  constructor(value) {
    if (typeof value !== 'string') {
      throw new Error('Wallet address must be a string');
    }
    
    this._value = value.trim();
    
    if (!this.isValid()) {
      throw new Error(`Invalid wallet address format: ${value}`);
    }
  }

  get value() {
    return this._value;
  }

  /**
   * Validation
   */
  isValid() {
    // Stacks addresses start with 'S' followed by alphanumeric characters
    // Standard format: ST1ABC...XYZ (testnet/devnet) or SP1ABC...XYZ (mainnet)
    const stacksAddressRegex = /^S[TP][0-9A-Z]{39}$/;
    return stacksAddressRegex.test(this._value);
  }

  /**
   * Address type detection
   */
  isMainnet() {
    return this._value.startsWith('SP');
  }

  isTestnet() {
    return this._value.startsWith('ST');
  }

  getNetwork() {
    if (this.isMainnet()) return 'mainnet';
    if (this.isTestnet()) return 'testnet';
    return 'unknown';
  }

  /**
   * Display methods
   */
  truncated(startLength = 8, endLength = 4) {
    if (this._value.length <= startLength + endLength + 3) {
      return this._value;
    }
    return `${this._value.slice(0, startLength)}···${this._value.slice(-endLength)}`;
  }

  formatted() {
    // Group address for better readability
    const groups = this._value.match(/.{1,8}/g) || [];
    return groups.join(' ');
  }

  /**
   * Comparison
   */
  equals(other) {
    return other instanceof WalletAddress && this._value === other._value;
  }

  /**
   * Hashing for use in data structures
   */
  hashCode() {
    let hash = 0;
    for (let i = 0; i < this._value.length; i++) {
      const char = this._value.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
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
   * Static validation helper
   */
  static isValidFormat(value) {
    try {
      new WalletAddress(value);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Static factory methods
   */
  static fromString(value) {
    return new WalletAddress(value);
  }

  /**
   * Generate sample addresses for testing
   */
  static generateSampleTestnet() {
    // Generate a sample testnet address for testing
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = 'ST';
    for (let i = 0; i < 38; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return new WalletAddress(result);
  }

  static generateSampleMainnet() {
    // Generate a sample mainnet address for testing
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = 'SP';
    for (let i = 0; i < 38; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return new WalletAddress(result);
  }
}