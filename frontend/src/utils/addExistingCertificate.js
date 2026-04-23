/**
 * Utility to manually add existing certificate IDs to storage
 * Run this in browser console to add certificates that were issued before the automatic storage was implemented
 */

// Import the certificate storage
import { certificateStorage } from '../services/certificateStorage.js';

/**
 * Add existing certificate to storage
 */
export function addExistingCertificate(certId, walletAddress, action = 'pending') {
  try {
    certificateStorage.storeCertificateId(certId, action, walletAddress);
    console.log(`✅ Added certificate ${certId} to storage for wallet ${walletAddress}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to add certificate:', error);
    return false;
  }
}

// For easy browser console use
window.addExistingCertificate = addExistingCertificate;

// Add the JJ Jameson certificate from the successful transaction
export function addJJJamesonCertificate(walletAddress) {
  return addExistingCertificate('SkogamFtZXNvbi0y', walletAddress, 'pending');
}