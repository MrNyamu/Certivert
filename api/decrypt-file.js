#!/usr/bin/env node

/**
 * Decrypt a downloaded IPFS file
 * Usage: node decrypt-file.js <path-to-encrypted-file>
 */

import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const crypto = require('crypto');

// Configuration matching your API
const ENCRYPTION_KEY = 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456';

/**
 * Decrypt file content (same logic as API)
 */
function decryptFile(encryptedBuffer, key) {
  if (encryptedBuffer.length < 16) {
    throw new Error('Invalid encrypted file: too short');
  }
  
  const iv = encryptedBuffer.slice(0, 16);
  const encryptedData = encryptedBuffer.slice(16);
  
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
  const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  
  return decrypted;
}

/**
 * Main function
 */
async function main() {
  const filePath = process.argv[2];
  
  if (!filePath) {
    console.error('Usage: node decrypt-file.js <path-to-encrypted-file>');
    console.error('');
    console.error('Example:');
    console.error('  node decrypt-file.js ~/Downloads/bafybeidwjdfvmkkjhqsjezwjgbuzqw4x2kcoj3bxkzy3yzbv42xit4gu5e');
    process.exit(1);
  }
  
  try {
    console.log(`Decrypting file: ${filePath}`);
    
    // Read encrypted file
    const encryptedBuffer = fs.readFileSync(filePath);
    console.log(`Read: ${encryptedBuffer.length} bytes (encrypted)`);
    
    // Decrypt file
    const decryptedBuffer = decryptFile(encryptedBuffer, ENCRYPTION_KEY);
    console.log(`Decrypted: ${decryptedBuffer.length} bytes`);
    console.log('');
    
    // Display content
    console.log('=== FILE CONTENT ===');
    console.log(decryptedBuffer.toString('utf8'));
    console.log('=== END CONTENT ===');
    console.log('');
    
    // Save decrypted file
    const outputPath = filePath + '.decrypted';
    fs.writeFileSync(outputPath, decryptedBuffer);
    console.log(`Decrypted file saved to: ${outputPath}`);
    
    // Show hex dump for binary files
    if (decryptedBuffer.length > 0) {
      console.log('=== HEX DUMP (first 256 bytes) ===');
      console.log(decryptedBuffer.slice(0, 256).toString('hex').match(/.{1,2}/g).join(' '));
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();