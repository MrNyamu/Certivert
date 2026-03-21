#!/usr/bin/env node

/**
 * Test script to fetch and view IPFS documents from Certivert API
 * Usage: node test-ipfs-fetch.js <CID>
 */

import { createRequire } from 'module';
import { create } from 'kubo-rpc-client';

const require = createRequire(import.meta.url);
const crypto = require('crypto');

// Configuration matching your API
const IPFS_API_URL = 'http://127.0.0.1:5001';
const ENCRYPTION_KEY = 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456';

// Create IPFS client instance (same as API)
const ipfs = create({ url: IPFS_API_URL });

/**
 * Fetch file from IPFS (same method as API)
 */
async function fetchFromIPFS(cid) {
  try {
    console.log(`Fetching file from IPFS: ${cid}`);
    
    // Collect chunks from IPFS (same as API)
    const chunks = [];
    for await (const chunk of ipfs.cat(cid)) {
      chunks.push(chunk);
    }
    
    const encryptedBuffer = Buffer.concat(chunks);
    console.log(`Downloaded encrypted file: ${encryptedBuffer.length} bytes`);
    
    return encryptedBuffer;
  } catch (error) {
    throw new Error(`Failed to fetch from IPFS: ${error.message}`);
  }
}

/**
 * Decrypt file content (exact same logic as API)
 */
function decryptData(encryptedData, key) {
  const algorithm = 'aes-256-cbc';
  const keyBuffer = Buffer.from(key, 'hex');
  
  if (keyBuffer.length !== 32) {
    throw new Error('Encryption key must be 32 bytes (64 hex characters)');
  }
  
  if (encryptedData.length < 16) {
    throw new Error('Encrypted data too short (missing IV)');
  }
  
  // Extract IV and encrypted data
  const iv = encryptedData.slice(0, 16);
  const encrypted = encryptedData.slice(16);
  
  console.log('Debug info:');
  console.log(`- Total encrypted size: ${encryptedData.length} bytes`);
  console.log(`- IV (16 bytes): ${iv.toString('hex')}`);
  console.log(`- Encrypted data size: ${encrypted.length} bytes`);
  
  // Decrypt the data
  const decipher = crypto.createDecipheriv(algorithm, keyBuffer, iv);
  
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);
  
  return decrypted;
}

/**
 * Main function
 */
async function main() {
  const cid = process.argv[2];
  
  if (!cid) {
    console.error('Usage: node test-ipfs-fetch.js <CID>');
    console.error('');
    console.error('Example CIDs from your tests:');
    console.error('  bafkreidlyrazlckq7mf5pk3o5mtusj7ubnszbc23ap72tgw6v2ipcp2mue');
    console.error('  bafkreicfbkuskdcltfuoryvilvbrxg3dsgajvi6zuf2xttpd7esro74sy4');
    process.exit(1);
  }
  
  try {
    console.log(`Fetching CID: ${cid}`);
    console.log(`From: ${IPFS_API_URL}`);
    console.log('');
    
    // Fetch encrypted file
    const encryptedBuffer = await fetchFromIPFS(cid);
    console.log(`Downloaded: ${encryptedBuffer.length} bytes (encrypted)`);
    
    // Decrypt file
    const decryptedBuffer = decryptData(encryptedBuffer, ENCRYPTION_KEY);
    console.log(`Decrypted: ${decryptedBuffer.length} bytes`);
    console.log('');
    
    // Display content
    console.log('=== FILE CONTENT ===');
    console.log(decryptedBuffer.toString('utf8'));
    console.log('=== END CONTENT ===');
    console.log('');
    
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