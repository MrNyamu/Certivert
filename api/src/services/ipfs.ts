import { create, type IPFSHTTPClient } from 'kubo-rpc-client';
import crypto from 'crypto';
import { config } from '../config.js';

// IPFS client instance
let ipfs: IPFSHTTPClient | null = null;

/**
 * Initialize IPFS client
 * @returns IPFS client instance
 */
function initIPFSClient(): IPFSHTTPClient {
  if (!ipfs) {
    ipfs = create({ url: config.IPFS_API_URL });
  }
  return ipfs;
}

/**
 * Encrypts data using AES-256-CBC
 * @param data - Data to encrypt
 * @param key - 32-byte encryption key (hex string)
 * @returns Encrypted data with IV prepended
 */
function encryptData(data: Buffer, key: string): Buffer {
  const algorithm = 'aes-256-cbc';
  const keyBuffer = Buffer.from(key, 'hex');
  
  if (keyBuffer.length !== 32) {
    throw new Error('Encryption key must be 32 bytes (64 hex characters)');
  }
  
  // Generate random IV
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);
  
  // Encrypt the data
  const encrypted = Buffer.concat([
    cipher.update(data),
    cipher.final()
  ]);
  
  // Prepend IV to encrypted data
  return Buffer.concat([iv, encrypted]);
}

/**
 * Decrypts data using AES-256-CBC
 * @param encryptedData - Encrypted data with IV prepended
 * @param key - 32-byte encryption key (hex string)
 * @returns Decrypted data
 */
function decryptData(encryptedData: Buffer, key: string): Buffer {
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
  
  // Decrypt the data
  const decipher = crypto.createDecipheriv(algorithm, keyBuffer, iv);
  
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);
  
  return decrypted;
}

/**
 * Uploads encrypted file to IPFS
 * @param fileBuffer - File buffer to upload
 * @returns IPFS CID of uploaded file
 */
export async function uploadToIPFS(fileBuffer: Buffer): Promise<{ cid: string }> {
  try {
    if (!Buffer.isBuffer(fileBuffer)) {
      throw new Error('Input must be a Buffer');
    }
    
    const client = initIPFSClient();
    console.log(`Uploading file to IPFS: ${fileBuffer.length} bytes`);
    
    // Encrypt the file buffer
    const encryptedBuffer = encryptData(fileBuffer, config.ENCRYPTION_KEY);
    console.log(`Encrypted file: ${encryptedBuffer.length} bytes (including IV)`);
    
    // Upload to IPFS
    const result = await client.add(encryptedBuffer, {
      pin: true,  // Pin the file immediately
      cidVersion: 1
    });
    
    const cid = result.cid.toString();
    console.log(`File uploaded to IPFS: ${cid}`);
    
    return { cid };
  } catch (error) {
    console.error('Error uploading to IPFS:', error);
    throw new Error(`Failed to upload to IPFS: ${(error as Error).message}`);
  }
}

/**
 * Fetches and decrypts file from IPFS
 * @param cid - IPFS Content ID
 * @returns Decrypted file buffer
 */
export async function fetchFromIPFS(cid: string): Promise<Buffer> {
  try {
    if (!cid || typeof cid !== 'string') {
      throw new Error('CID must be a non-empty string');
    }
    
    const client = initIPFSClient();
    console.log(`Fetching file from IPFS: ${cid}`);
    
    // Collect chunks from IPFS
    const chunks: Uint8Array[] = [];
    for await (const chunk of client.cat(cid)) {
      chunks.push(chunk);
    }
    
    const encryptedBuffer = Buffer.concat(chunks);
    console.log(`Downloaded encrypted file: ${encryptedBuffer.length} bytes`);
    
    // Decrypt the buffer
    const decryptedBuffer = decryptData(encryptedBuffer, config.ENCRYPTION_KEY);
    console.log(`Decrypted file: ${decryptedBuffer.length} bytes`);
    
    return decryptedBuffer;
  } catch (error) {
    console.error('Error fetching from IPFS:', error);
    throw new Error(`Failed to fetch from IPFS: ${(error as Error).message}`);
  }
}

/**
 * Pins a CID on the local IPFS node
 * @param cid - IPFS Content ID to pin
 */
export async function pinCID(cid: string): Promise<void> {
  try {
    if (!cid || typeof cid !== 'string') {
      throw new Error('CID must be a non-empty string');
    }
    
    const client = initIPFSClient();
    console.log(`Pinning CID: ${cid}`);
    await client.pin.add(cid);
    console.log(`Successfully pinned: ${cid}`);
  } catch (error) {
    console.error('Error pinning CID:', error);
    throw new Error(`Failed to pin CID: ${(error as Error).message}`);
  }
}

/**
 * Checks if IPFS node is online and accessible
 * @returns True if IPFS is accessible
 */
export async function checkIPFSConnection(): Promise<boolean> {
  try {
    const client = initIPFSClient();
    const nodeInfo = await client.id();
    console.log(`Connected to IPFS node: ${nodeInfo.id}`);
    return true;
  } catch (error) {
    console.error('Failed to connect to IPFS:', error);
    return false;
  }
}

/**
 * Clean up IPFS client
 * Note: kubo-rpc-client is just an HTTP client and doesn't require explicit cleanup
 */
export async function closeIPFSClient(): Promise<void> {
  try {
    // Simply reset the client reference - no need to call stop() as it's just an HTTP client
    ipfs = null;
    console.log('IPFS client reference cleared');
  } catch (error) {
    console.error('Error closing IPFS client:', error);
  }
}