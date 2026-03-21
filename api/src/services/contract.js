import StacksTransactions from '@stacks/transactions';
const {
  makeContractCall,
  makeReadOnlyContractCall,
  broadcastTransaction,
  stringAsciiCV,
  principalCV,
  uintCV,
  standardPrincipalCV
} = StacksTransactions;

import StacksNetwork from '@stacks/network';
const { STACKS_TESTNET, STACKS_DEVNET, STACKS_MAINNET, createNetwork } = StacksNetwork;
import { config } from '../config.js';

// Create network instance based on configuration  
function getNetwork() {
  switch (config.STACKS_NETWORK) {
    case 'mainnet':
      return STACKS_MAINNET;
    case 'testnet':
      return STACKS_TESTNET;
    case 'devnet':
    default:
      return STACKS_DEVNET;
  }
}

/**
 * Proposes a certificate for issuance
 * @param {string} certId - Certificate ID (SHA-256 hash)
 * @param {Object} certData - Certificate data
 * @param {string} ipfsCid - IPFS Content ID
 * @param {string} signerKey - Private key of the proposer
 * @returns {Promise<string>} - Transaction ID
 */
export async function proposeCertificate(certId, certData, ipfsCid, signerKey) {
  try {
    const network = getNetwork();
    
    console.log(`Proposing certificate: ${certId}`);
    
    const txOptions = {
      contractAddress: config.CONTRACT_ADDRESS,
      contractName: config.CONTRACT_NAME_CERTS,
      functionName: 'propose-certificate',
      functionArgs: [
        stringAsciiCV(certId),
        stringAsciiCV(certData.studentName),
        stringAsciiCV(certData.admissionNo),
        stringAsciiCV(certData.programme),
        uintCV(certData.year),
        stringAsciiCV(certData.grade),
        stringAsciiCV(ipfsCid),
        stringAsciiCV(certData.certHash)
      ],
      senderKey: signerKey,
      network,
      anchorMode: 1, // Any anchor mode for devnet
      fee: 1000 // 0.001 STX fee
    };
    
    const transaction = await makeContractCall(txOptions);
    const result = await broadcastTransaction(transaction, network);
    
    console.log(`Propose transaction broadcast: ${result.txid}`);
    return result.txid;
  } catch (error) {
    console.error('Error proposing certificate:', error);
    throw new Error(`Failed to propose certificate: ${error.message}`);
  }
}

/**
 * Approves a certificate (completes 2-of-2 threshold)
 * @param {string} certId - Certificate ID
 * @param {string} signer2Key - Private key of the second signer
 * @returns {Promise<string>} - Transaction ID
 */
export async function approveCertificate(certId, signer2Key) {
  try {
    const network = getNetwork();
    
    console.log(`Approving certificate: ${certId}`);
    
    const txOptions = {
      contractAddress: config.CONTRACT_ADDRESS,
      contractName: config.CONTRACT_NAME_CERTS,
      functionName: 'approve-certificate',
      functionArgs: [stringAsciiCV(certId)],
      senderKey: signer2Key,
      network,
      anchorMode: 1,
      fee: 1000
    };
    
    const transaction = await makeContractCall(txOptions);
    const result = await broadcastTransaction(transaction, network);
    
    console.log(`Approve transaction broadcast: ${result.txid}`);
    return result.txid;
  } catch (error) {
    console.error('Error approving certificate:', error);
    throw new Error(`Failed to approve certificate: ${error.message}`);
  }
}

/**
 * Revokes a certificate
 * @param {string} certId - Certificate ID
 * @param {string} callerKey - Private key of the revoker
 * @returns {Promise<string>} - Transaction ID
 */
export async function revokeCertificate(certId, callerKey) {
  try {
    const network = getNetwork();
    
    console.log(`Revoking certificate: ${certId}`);
    
    const txOptions = {
      contractAddress: config.CONTRACT_ADDRESS,
      contractName: config.CONTRACT_NAME_CERTS,
      functionName: 'revoke-certificate',
      functionArgs: [stringAsciiCV(certId)],
      senderKey: callerKey,
      network,
      anchorMode: 1,
      fee: 1000
    };
    
    const transaction = await makeContractCall(txOptions);
    const result = await broadcastTransaction(transaction, network);
    
    console.log(`Revoke transaction broadcast: ${result.txid}`);
    return result.txid;
  } catch (error) {
    console.error('Error revoking certificate:', error);
    throw new Error(`Failed to revoke certificate: ${error.message}`);
  }
}

/**
 * Verifies a certificate status
 * @param {string} certId - Certificate ID
 * @returns {Promise<{status: string, certificate: Object|null}>}
 */
export async function verifyCertificate(certId) {
  try {
    const network = getNetwork();
    
    console.log(`Verifying certificate: ${certId}`);
    
    const options = {
      contractAddress: config.CONTRACT_ADDRESS,
      contractName: config.CONTRACT_NAME_CERTS,
      functionName: 'verify-certificate',
      functionArgs: [stringAsciiCV(certId)],
      network,
      senderAddress: config.CONTRACT_ADDRESS
    };
    
    const result = await makeReadOnlyContractCall(options);
    
    // Parse the result
    if (result.type === 'tuple') {
      const status = result.data.status?.data || 'UNKNOWN';
      const certificate = result.data.certificate?.type === 'none' 
        ? null 
        : parseCertificateData(result.data.certificate.value);
      
      console.log(`Certificate verification result: ${status}`);
      return { status, certificate };
    }
    
    throw new Error('Unexpected response format from contract');
  } catch (error) {
    console.error('Error verifying certificate:', error);
    throw new Error(`Failed to verify certificate: ${error.message}`);
  }
}

/**
 * Gets pending transaction details
 * @param {string} certId - Certificate ID
 * @returns {Promise<Object|null>} - Pending transaction data or null
 */
export async function getPendingTx(certId) {
  try {
    const network = getNetwork();
    
    console.log(`Getting pending tx: ${certId}`);
    
    const options = {
      contractAddress: config.CONTRACT_ADDRESS,
      contractName: config.CONTRACT_NAME_CERTS,
      functionName: 'get-pending-tx',
      functionArgs: [stringAsciiCV(certId)],
      network,
      senderAddress: config.CONTRACT_ADDRESS
    };
    
    const result = await makeReadOnlyContractCall(options);
    
    if (result.type === 'none') {
      return null;
    }
    
    if (result.type === 'some') {
      return parsePendingTxData(result.value);
    }
    
    throw new Error('Unexpected response format from contract');
  } catch (error) {
    console.error('Error getting pending tx:', error);
    throw new Error(`Failed to get pending tx: ${error.message}`);
  }
}

/**
 * Gets private keys based on role for prototype
 * @param {string} role - Role ('university' or 'knqa')
 * @returns {string} - Private key
 */
export function getKeyByRole(role) {
  switch (role) {
    case 'university':
      return config.DEPLOYER_PRIVATE_KEY;
    case 'knqa':
      return config.SIGNER_2_PRIVATE_KEY;
    default:
      throw new Error(`Invalid role: ${role}`);
  }
}

/**
 * Parses certificate data from Clarity value
 * @param {Object} clarityValue - Clarity tuple value
 * @returns {Object} - Parsed certificate object
 */
function parseCertificateData(clarityValue) {
  if (!clarityValue || clarityValue.type !== 'tuple') {
    return null;
  }
  
  const data = clarityValue.data;
  return {
    studentName: data['student-name']?.data || '',
    admissionNo: data['admission-no']?.data || '',
    programme: data.programme?.data || '',
    year: parseInt(data.year?.value || '0'),
    grade: data.grade?.data || '',
    ipfsCid: data['ipfs-cid']?.data || '',
    certHash: data['cert-hash']?.data || '',
    issuedBy: data['issued-by']?.data || '',
    issuedAt: parseInt(data['issued-at']?.value || '0'),
    revoked: data.revoked?.type === 'true',
    revokedBy: data['revoked-by']?.type === 'some' ? data['revoked-by'].value?.data : null,
    revokedAt: data['revoked-at']?.type === 'some' ? parseInt(data['revoked-at'].value?.value || '0') : null
  };
}

/**
 * Parses pending transaction data from Clarity value
 * @param {Object} clarityValue - Clarity tuple value
 * @returns {Object} - Parsed pending transaction object
 */
function parsePendingTxData(clarityValue) {
  if (!clarityValue || clarityValue.type !== 'tuple') {
    return null;
  }
  
  const data = clarityValue.data;
  const certData = parseCertificateData(data['cert-data']);
  
  return {
    proposer: data.proposer?.data || '',
    signer2: data['signer-2']?.type === 'some' ? data['signer-2'].value?.data : null,
    certData,
    signatures: parseInt(data.signatures?.value || '0'),
    proposedAt: parseInt(data['proposed-at']?.value || '0')
  };
}