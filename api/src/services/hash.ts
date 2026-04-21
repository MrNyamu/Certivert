import crypto from 'crypto';
import type { CertificateData } from '../types/index.js';

/**
 * Computes SHA-256 hash of certificate data
 * @param certData - Certificate data object
 * @returns 64-character hex string (cert-id)
 */
export function computeCertHash(certData: CertificateData): string {
  // Validate input
  if (!certData || typeof certData !== 'object') {
    throw new Error('Certificate data must be an object');
  }

  const { studentName, admissionNo, programme, year, grade } = certData;
  
  // Validate required fields
  const requiredFields = { studentName, admissionNo, programme, year, grade };
  for (const [key, value] of Object.entries(requiredFields)) {
    if (value === undefined || value === null || value === '') {
      throw new Error(`Missing required field: ${key}`);
    }
  }

  // Create canonical representation
  const canonicalData = {
    studentName: studentName.trim(),
    admissionNo: admissionNo.trim(),
    programme: programme.trim(),
    year: Number(year),
    grade: grade.trim()
  };

  // Sort keys to ensure deterministic output
  const sortedKeys = Object.keys(canonicalData).sort();
  const sortedData: Record<string, string | number> = {};
  for (const key of sortedKeys) {
    sortedData[key] = canonicalData[key as keyof typeof canonicalData];
  }

  // Create JSON string (no extra spaces)
  const jsonString = JSON.stringify(sortedData);
  
  // Compute SHA-256 hash
  const hash = crypto.createHash('sha256').update(jsonString, 'utf8').digest('hex');
  
  console.log(`Computed hash for cert data: ${jsonString} -> ${hash}`);
  
  return hash;
}

/**
 * Computes SHA-256 hash of a buffer (for PDF files)
 * @param buffer - File buffer
 * @returns 64-character hex string
 */
export function computeFileHash(buffer: Buffer): string {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('Input must be a Buffer');
  }
  
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  console.log(`Computed file hash: ${buffer.length} bytes -> ${hash}`);
  
  return hash;
}

/**
 * Validates that a string is a valid SHA-256 hex string
 * @param hash - Hash string to validate
 * @returns True if valid SHA-256 hex string
 */
export function isValidHash(hash: string): boolean {
  if (typeof hash !== 'string') return false;
  if (hash.length !== 64) return false;
  return /^[a-f0-9]{64}$/i.test(hash);
}