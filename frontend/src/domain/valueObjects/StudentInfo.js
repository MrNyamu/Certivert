/**
 * Student Info Value Object
 * Represents student information within a certificate
 */

export class StudentInfo {
  constructor({ name, admissionNo, principal = null }) {
    if (!name || typeof name !== 'string') {
      throw new Error('Student name is required and must be a string');
    }
    
    if (!admissionNo || typeof admissionNo !== 'string') {
      throw new Error('Admission number is required and must be a string');
    }

    this._name = name.trim();
    this._admissionNo = admissionNo.trim().toUpperCase();
    this._principal = principal;

    if (!this.isValid()) {
      throw new Error('Invalid student information');
    }
  }

  get name() {
    return this._name;
  }

  get admissionNo() {
    return this._admissionNo;
  }

  get principal() {
    return this._principal;
  }

  /**
   * Validation
   */
  isValid() {
    return this.isValidName(this._name) && this.isValidAdmissionNo(this._admissionNo);
  }

  isValidName(name) {
    // Name should be at least 2 characters and only contain letters, spaces, hyphens, and apostrophes
    const nameRegex = /^[a-zA-Z\s\-']{2,}$/;
    return nameRegex.test(name.trim());
  }

  isValidAdmissionNo(admissionNo) {
    // Admission number should be alphanumeric and at least 3 characters
    const admissionRegex = /^[A-Z0-9]{3,20}$/;
    return admissionRegex.test(admissionNo.trim());
  }

  /**
   * Display methods
   */
  getFormattedName() {
    // Convert to title case
    return this._name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  getInitials() {
    return this._name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('');
  }

  getDisplayText() {
    return `${this.getFormattedName()} (${this._admissionNo})`;
  }

  /**
   * Search helpers
   */
  matchesSearchTerm(searchTerm) {
    if (!searchTerm) return true;
    
    const term = searchTerm.toLowerCase();
    return (
      this._name.toLowerCase().includes(term) ||
      this._admissionNo.toLowerCase().includes(term)
    );
  }

  /**
   * Comparison
   */
  equals(other) {
    return (
      other instanceof StudentInfo &&
      this._name === other._name &&
      this._admissionNo === other._admissionNo &&
      this._principal === other._principal
    );
  }

  /**
   * Hashing for data structures
   */
  hashCode() {
    let hash = 0;
    const str = this._name + this._admissionNo;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  /**
   * Serialization
   */
  toJSON() {
    return {
      name: this._name,
      admissionNo: this._admissionNo,
      principal: this._principal
    };
  }

  toString() {
    return this.getDisplayText();
  }

  /**
   * Factory methods
   */
  static fromJSON(data) {
    return new StudentInfo({
      name: data.name,
      admissionNo: data.admissionNo,
      principal: data.principal
    });
  }

  static create(name, admissionNo, principal = null) {
    return new StudentInfo({ name, admissionNo, principal });
  }

  /**
   * Validation helper
   */
  static isValidStudentInfo(data) {
    try {
      new StudentInfo(data);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Name parsing helpers
   */
  getFirstName() {
    return this._name.split(' ')[0];
  }

  getLastName() {
    const parts = this._name.split(' ');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  }

  getMiddleNames() {
    const parts = this._name.split(' ');
    return parts.length > 2 ? parts.slice(1, -1).join(' ') : '';
  }

  /**
   * Update methods (returns new instance for immutability)
   */
  withPrincipal(principal) {
    return new StudentInfo({
      name: this._name,
      admissionNo: this._admissionNo,
      principal
    });
  }

  updateName(name) {
    return new StudentInfo({
      name,
      admissionNo: this._admissionNo,
      principal: this._principal
    });
  }
}