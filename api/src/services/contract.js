import StacksTransactions from '@stacks/transactions';
const {
  makeContractCall,
  fetchCallReadOnlyFunction,
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
    console.log(`Using signer key: ${signerKey ? 'PROVIDED' : 'MISSING'}`);
    
    // Validate private key format
    if (!signerKey) {
      throw new Error('Private key is required but not provided');
    }
    
    if (typeof signerKey !== 'string') {
      throw new Error('Private key must be a string');
    }
    
    // Remove 0x prefix if present and validate hex format
    const cleanKey = signerKey.startsWith('0x') ? signerKey.slice(2) : signerKey;
    if (cleanKey.length !== 64 || !/^[a-fA-F0-9]+$/.test(cleanKey)) {
      console.error(`Invalid private key format. Length: ${cleanKey.length}, Valid hex: ${/^[a-fA-F0-9]+$/.test(cleanKey)}`);
      throw new Error('Private key must be 64 character hex string');
    }
    
    console.log(`Private key validation: PASSED (length: ${cleanKey.length})`);
    
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
    
    // Validate transaction object before broadcasting
    console.log(`Transaction object type: ${typeof transaction}`);
    console.log(`Transaction object keys:`, transaction ? Object.keys(transaction) : 'NONE');
    console.log(`Has serialize method: ${transaction && typeof transaction.serialize === 'function'}`);
    
    if (!transaction) {
      console.error('Transaction is null/undefined:', {
        transaction: transaction,
        senderKey: signerKey ? 'PROVIDED' : 'MISSING',
        txOptions: { ...txOptions, senderKey: 'REDACTED' }
      });
      throw new Error('makeContractCall returned null/undefined transaction');
    }
    
    if (typeof transaction.serialize !== 'function') {
      console.error('Transaction missing serialize method:', {
        transaction: transaction,
        transactionType: typeof transaction,
        transactionKeys: Object.keys(transaction),
        senderKey: signerKey ? 'PROVIDED' : 'MISSING',
        txOptions: { ...txOptions, senderKey: 'REDACTED' }
      });
      throw new Error('Transaction object is missing serialize method');
    }
    
    console.log(`Transaction created successfully for cert: ${certId}`);
    console.log(`About to broadcast transaction with network: ${network?.coreApiUrl}`);
    
    // Add comprehensive debugging
    console.log('Network details:', {
      coreApiUrl: network?.coreApiUrl,
      broadcastEndpoint: network?.broadcastEndpoint,
      transferFeeEstimateEndpoint: network?.transferFeeEstimateEndpoint
    });
    
    console.log('Transaction details:', {
      hasSerialize: typeof transaction.serialize === 'function',
      txType: transaction.payload?.payloadType || 'unknown'
    });
    
    // Log the serialized transaction for debugging
    try {
      const serializedTx = transaction.serialize();
      console.log(`Serialized transaction length: ${serializedTx.length} bytes`);
      console.log(`Serialized transaction (first 100 chars): ${serializedTx.toString('hex').substring(0, 100)}...`);
    } catch (serErr) {
      console.error('Failed to serialize transaction for debugging:', serErr.message);
    }
    
    const result = await broadcastTransaction({ 
      transaction, 
      network 
    });
    
    console.log(`Broadcast result:`, result);
    console.log(`Broadcast result type:`, typeof result);
    console.log(`Broadcast result keys:`, result ? Object.keys(result) : 'NONE');
    
    // If result is a string, it might be the transaction ID directly
    // If result is an object, look for common properties
    let txId = null;
    if (typeof result === 'string') {
      txId = result;
    } else if (result?.txid) {
      txId = result.txid;
    } else if (result?.txId) {
      txId = result.txId;
    } else if (result?.transaction_id) {
      txId = result.transaction_id;
    } else if (result?.result) {
      txId = result.result;
    }
    
    console.log(`Extracted transaction ID: ${txId}`);
    console.log(`Propose transaction broadcast: ${txId}`);
    
    // Verify transaction was actually broadcast by checking mempool
    if (txId) {
      setTimeout(async () => {
        try {
          const mempoolCheck = await fetch(`${network.coreApiUrl}/extended/v1/tx/mempool?limit=50`);
          if (mempoolCheck.ok) {
            const mempool = await mempoolCheck.json();
            const foundInMempool = mempool.results?.some(tx => tx.tx_id === txId || tx.tx_id === `0x${txId}`);
            console.log(`Transaction ${txId} found in mempool: ${foundInMempool}`);
          }
        } catch (e) {
          console.log('Failed to check mempool:', e.message);
        }
      }, 1000); // Check after 1 second
    }
    
    return txId;
  } catch (error) {
    console.error('Error proposing certificate:', error);
    const currentNetwork = getNetwork();
    console.error('Detailed error context:', {
      certId,
      signerKey: signerKey ? 'PROVIDED' : 'MISSING',
      network: currentNetwork?.coreApiUrl || 'UNKNOWN',
      error: error.message
    });
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
    console.log(`Using signer2 key: ${signer2Key ? 'PROVIDED' : 'MISSING'}`);
    
    // Validate private key format
    if (!signer2Key) {
      throw new Error('Signer2 private key is required but not provided');
    }
    
    if (typeof signer2Key !== 'string') {
      throw new Error('Signer2 private key must be a string');
    }
    
    // Remove 0x prefix if present and validate hex format
    const cleanKey = signer2Key.startsWith('0x') ? signer2Key.slice(2) : signer2Key;
    if (cleanKey.length !== 64 || !/^[a-fA-F0-9]+$/.test(cleanKey)) {
      console.error(`Invalid signer2 private key format. Length: ${cleanKey.length}, Valid hex: ${/^[a-fA-F0-9]+$/.test(cleanKey)}`);
      throw new Error('Signer2 private key must be 64 character hex string');
    }
    
    console.log(`Signer2 private key validation: PASSED (length: ${cleanKey.length})`);
    
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
    
    // Validate transaction object before broadcasting
    if (!transaction || typeof transaction.serialize !== 'function') {
      console.error('Invalid transaction object:', {
        transaction: transaction,
        signer2Key: signer2Key ? 'PROVIDED' : 'MISSING',
        txOptions: { ...txOptions, senderKey: 'REDACTED' }
      });
      throw new Error('Failed to create valid transaction object - check signer2Key and network configuration');
    }
    
    console.log(`Approve transaction created successfully for cert: ${certId}`);
    
    const result = await broadcastTransaction({ 
      transaction, 
      network 
    });
    
    console.log(`Approve broadcast result:`, result);
    console.log(`Approve broadcast result type:`, typeof result);
    console.log(`Approve broadcast result keys:`, result ? Object.keys(result) : 'NONE');
    console.log(`Approve transaction broadcast: ${result.txid || result}`);
    return result.txid || result;
  } catch (error) {
    console.error('Error approving certificate:', error);
    const currentNetwork = getNetwork();
    console.error('Detailed error context:', {
      certId,
      signer2Key: signer2Key ? 'PROVIDED' : 'MISSING',
      network: currentNetwork?.coreApiUrl || 'UNKNOWN',
      error: error.message
    });
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
    const result = await broadcastTransaction({ 
      transaction, 
      network 
    });
    
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
    
    const result = await fetchCallReadOnlyFunction(options);
    
    console.log(`Read-only function result:`, result);
    console.log(`Result type:`, typeof result);
    console.log(`Result keys:`, result ? Object.keys(result) : 'NONE');
    
    // fetchCallReadOnlyFunction returns the result directly, not wrapped
    // Check if result has the expected structure
    if (result && typeof result === 'object') {
      // Handle the response structure from fetchCallReadOnlyFunction
      let actualData = result;
      
      // If result has a 'result' property, use that
      if (result.result) {
        actualData = result.result;
      }
      
      // Check if actualData has the tuple structure we expect
      if (actualData && actualData.type === 'tuple' && actualData.data) {
        const status = actualData.data.status?.data || 'UNKNOWN';
        const certificate = actualData.data.certificate?.type === 'none' 
          ? null 
          : parseCertificateData(actualData.data.certificate.value);
        
        console.log(`Certificate verification result: ${status}`);
        return { status, certificate };
      }
      
      // If it's a direct tuple response
      if (actualData.status && actualData.certificate !== undefined) {
        const status = actualData.status || 'UNKNOWN';
        const certificate = actualData.certificate === null 
          ? null 
          : parseCertificateData(actualData.certificate);
        
        console.log(`Certificate verification result (direct): ${status}`);
        return { status, certificate };
      }
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
    
    const result = await fetchCallReadOnlyFunction(options);
    
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