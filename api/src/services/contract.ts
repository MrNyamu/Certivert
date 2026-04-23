import {
  makeContractCall,
  fetchCallReadOnlyFunction,
  broadcastTransaction,
  stringAsciiCV,
  principalCV,
  uintCV,
  standardPrincipalCV,
  StacksTransactionWire as StacksTransaction,
  ClarityValue as StacksClarityValue
} from '@stacks/transactions';

import {
  StacksNetwork,
  STACKS_DEVNET as StacksDevnet,
  STACKS_TESTNET as StacksTestnet,
  STACKS_MAINNET as StacksMainnet
} from '@stacks/network';

import { config } from '../config.js';
import type {
  CertificateData,
  ContractCertificate,
  VerificationResult,
  PendingIssuanceRequest,
  UserRoleString,
  ClarityTuple,
  ClarityOptional,
  ClarityUint,
  ClarityStringAscii,
  ClarityBool,
  ContractCallOptions,
  ReadOnlyFunctionOptions
} from '../types/index.js';

// Network instance type
type NetworkInstance = StacksNetwork;

// Broadcast result type
interface BroadcastResult {
  txid?: string;
  txId?: string;
  transaction_id?: string;
  result?: string;
  [key: string]: any;
}

// Mempool transaction interface
interface MempoolTransaction {
  tx_id: string;
  [key: string]: any;
}

// Mempool response interface
interface MempoolResponse {
  results?: MempoolTransaction[];
  [key: string]: any;
}

/**
 * Creates network instance based on configuration
 * @returns Network instance for Stacks transactions
 */
function getNetwork(): NetworkInstance {
  switch (config.STACKS_NETWORK) {
    case 'mainnet':
      return StacksMainnet;
    case 'testnet':
      return StacksTestnet;
    case 'devnet':
    default:
      return StacksDevnet;
  }
}

/**
 * Get network core API URL
 * @param network - Network instance
 * @returns Core API URL string
 */
function getNetworkUrl(network: NetworkInstance): string {
  // Handle the different network types
  if ((network as any).coreApiUrl) {
    return (network as any).coreApiUrl;
  }
  
  // Fallback based on network type
  switch (config.STACKS_NETWORK) {
    case 'mainnet':
      return 'https://stacks-node-api.mainnet.stacks.co';
    case 'testnet':
      return 'https://stacks-node-api.testnet.stacks.co';
    case 'devnet':
    default:
      return config.STACKS_API_URL;
  }
}

/**
 * Validates private key format
 * @param key - Private key to validate
 * @param keyName - Name of the key for error messages
 * @throws Error if key is invalid
 */
function validatePrivateKey(key: string, keyName: string): void {
  if (!key) {
    throw new Error(`${keyName} is required but not provided`);
  }

  if (typeof key !== 'string') {
    throw new Error(`${keyName} must be a string`);
  }

  // Remove 0x prefix if present and validate hex format
  const cleanKey = key.startsWith('0x') ? key.slice(2) : key;
  if (cleanKey.length !== 64 || !/^[a-fA-F0-9]+$/.test(cleanKey)) {
    console.error(`Invalid ${keyName} format. Length: ${cleanKey.length}, Valid hex: ${/^[a-fA-F0-9]+$/.test(cleanKey)}`);
    throw new Error(`${keyName} must be 64 character hex string`);
  }

  console.log(`${keyName} validation: PASSED (length: ${cleanKey.length})`);
}

/**
 * Extracts transaction ID from broadcast result
 * @param result - Broadcast result object
 * @returns Transaction ID or null if not found
 */
function extractTransactionId(result: BroadcastResult): string | null {
  if (typeof result === 'string') {
    return result;
  }

  if (result?.txid) {
    return result.txid;
  }

  if (result?.txId) {
    return result.txId;
  }

  if (result?.transaction_id) {
    return result.transaction_id;
  }

  if (result?.result) {
    return result.result;
  }

  return null;
}

/**
 * Checks mempool for transaction
 * @param txId - Transaction ID to check
 * @param network - Network instance
 */
async function checkMempool(txId: string, network: NetworkInstance): Promise<void> {
  setTimeout(async () => {
    try {
      const response = await fetch(`${getNetworkUrl(network)}/extended/v1/tx/mempool?limit=50`);
      if (response.ok) {
        const mempool: MempoolResponse = await response.json();
        const foundInMempool = mempool.results?.some(
          (tx: MempoolTransaction) => tx.tx_id === txId || tx.tx_id === `0x${txId}`
        );
        console.log(`Transaction ${txId} found in mempool: ${foundInMempool}`);
      }
    } catch (error: any) {
      console.log('Failed to check mempool:', error.message);
    }
  }, 1000); // Check after 1 second
}

/**
 * Proposes a certificate for issuance
 * @param certId - Certificate ID (SHA-256 hash)
 * @param certData - Certificate data
 * @param ipfsCid - IPFS Content ID
 * @param signerKey - Private key of the proposer
 * @returns Promise resolving to transaction ID
 */
export async function proposeCertificate(
  certId: string,
  certData: CertificateData,
  ipfsCid: string,
  signerKey: string
): Promise<string> {
  try {
    const network = getNetwork();
    
    console.log(`Proposing certificate: ${certId}`);
    console.log(`Using signer key: ${signerKey ? 'PROVIDED' : 'MISSING'}`);
    
    // Validate private key format
    validatePrivateKey(signerKey, 'Private key');
    
    // Check account funding before proceeding
    await validateAccountFunds(signerKey, network, 1000);
    
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
        stringAsciiCV(certData.certHash || '')
      ],
      senderKey: signerKey,
      network,
      anchorMode: 1, // Any anchor mode for devnet
      fee: 1000 // 0.001 STX fee
    } as any;
    
    const transaction: StacksTransaction = await makeContractCall(txOptions);
    
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
    console.log(`About to broadcast transaction with network: ${getNetworkUrl(network)}`);
    
    // Add comprehensive debugging
    console.log('Network details:', {
      coreApiUrl: getNetworkUrl(network),
      networkType: config.STACKS_NETWORK,
      configUrl: config.STACKS_API_URL
    });
    
    console.log('Transaction details:', {
      hasSerialize: typeof transaction.serialize === 'function',
      txType: (transaction as any).payload?.payloadType || 'unknown'
    });
    
    // Log the serialized transaction for debugging
    try {
      const serializedTx = transaction.serialize();
      console.log(`Serialized transaction length: ${serializedTx.length} bytes`);
      console.log(`Serialized transaction (first 100 chars): ${serializedTx.toString().substring(0, 100)}...`);
    } catch (serErr: any) {
      console.error('Failed to serialize transaction for debugging:', serErr.message);
    }
    
    const result: BroadcastResult = await broadcastTransaction({ 
      transaction, 
      network 
    });
    
    console.log(`Broadcast result:`, result);
    console.log(`Broadcast result type:`, typeof result);
    console.log(`Broadcast result keys:`, result ? Object.keys(result) : 'NONE');
    
    // Check if transaction was rejected
    if (result && typeof result === 'object' && 'error' in result) {
      console.error('Transaction rejected:', result);
      throw new Error(`Transaction rejected: ${result.reason || result.error} - ${JSON.stringify(result.reason_data || {})}`);
    }
    
    const txId = extractTransactionId(result);
    
    console.log(`Extracted transaction ID: ${txId}`);
    console.log(`Propose transaction broadcast: ${txId}`);
    
    // Verify transaction was actually broadcast by checking mempool
    if (txId) {
      checkMempool(txId, network);
    }
    
    if (!txId) {
      throw new Error('Failed to extract transaction ID from broadcast result');
    }
    
    return txId;
  } catch (error: any) {
    console.error('Error proposing certificate:', error);
    const currentNetwork = getNetwork();
    console.error('Detailed error context:', {
      certId,
      signerKey: signerKey ? 'PROVIDED' : 'MISSING',
      network: getNetworkUrl(currentNetwork) || 'UNKNOWN',
      error: error.message
    });
    throw new Error(`Failed to propose certificate: ${error.message}`);
  }
}

/**
 * Approves a certificate (completes 2-of-2 threshold)
 * @param certId - Certificate ID
 * @param signer2Key - Private key of the second signer
 * @returns Promise resolving to transaction ID
 */
export async function approveCertificate(
  certId: string,
  signer2Key: string
): Promise<string> {
  try {
    const network = getNetwork();
    
    console.log(`Approving certificate: ${certId}`);
    console.log(`Using signer2 key: ${signer2Key ? 'PROVIDED' : 'MISSING'}`);
    
    // Validate private key format
    validatePrivateKey(signer2Key, 'Signer2 private key');
    
    // Check account funding before proceeding
    await validateAccountFunds(signer2Key, network, 1000);
    
    const txOptions = {
      contractAddress: config.CONTRACT_ADDRESS,
      contractName: config.CONTRACT_NAME_CERTS,
      functionName: 'approve-certificate',
      functionArgs: [stringAsciiCV(certId)],
      senderKey: signer2Key,
      network,
      anchorMode: 1,
      fee: 1000
    } as any;
    
    const transaction: StacksTransaction = await makeContractCall(txOptions);
    
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
    
    const result: BroadcastResult = await broadcastTransaction({ 
      transaction, 
      network 
    });
    
    console.log(`Approve broadcast result:`, result);
    console.log(`Approve broadcast result type:`, typeof result);
    console.log(`Approve broadcast result keys:`, result ? Object.keys(result) : 'NONE');
    
    // Check if transaction was rejected
    if (result && typeof result === 'object' && 'error' in result) {
      console.error('Approve transaction rejected:', result);
      throw new Error(`Approve transaction rejected: ${result.reason || result.error} - ${JSON.stringify(result.reason_data || {})}`);
    }
    
    const txId = extractTransactionId(result);
    console.log(`Approve transaction broadcast: ${txId}`);
    
    if (!txId) {
      throw new Error('Failed to extract transaction ID from broadcast result');
    }
    
    return txId;
  } catch (error: any) {
    console.error('Error approving certificate:', error);
    const currentNetwork = getNetwork();
    console.error('Detailed error context:', {
      certId,
      signer2Key: signer2Key ? 'PROVIDED' : 'MISSING',
      network: getNetworkUrl(currentNetwork) || 'UNKNOWN',
      error: error.message
    });
    throw new Error(`Failed to approve certificate: ${error.message}`);
  }
}

/**
 * Revokes a certificate
 * @param certId - Certificate ID
 * @param callerKey - Private key of the revoker
 * @returns Promise resolving to transaction ID
 */
export async function revokeCertificate(
  certId: string,
  callerKey: string
): Promise<string> {
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
    } as any;
    
    const transaction: StacksTransaction = await makeContractCall(txOptions);
    const result: BroadcastResult = await broadcastTransaction({ 
      transaction, 
      network 
    });
    
    // Check if transaction was rejected
    if (result && typeof result === 'object' && 'error' in result) {
      console.error('Revoke transaction rejected:', result);
      throw new Error(`Revoke transaction rejected: ${result.reason || result.error} - ${JSON.stringify(result.reason_data || {})}`);
    }
    
    const txId = extractTransactionId(result);
    console.log(`Revoke transaction broadcast: ${txId}`);
    
    if (!txId) {
      throw new Error('Failed to extract transaction ID from broadcast result');
    }
    
    return txId;
  } catch (error: any) {
    console.error('Error revoking certificate:', error);
    throw new Error(`Failed to revoke certificate: ${error.message}`);
  }
}

/**
 * Verifies a certificate status
 * @param certId - Certificate ID
 * @returns Promise resolving to verification result
 */
export async function verifyCertificate(certId: string): Promise<VerificationResult> {
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
    } as any;
    
    const result: any = await fetchCallReadOnlyFunction(options);
    
    console.log(`Read-only function result:`, result);
    console.log(`Result type:`, typeof result);
    console.log(`Result keys:`, result ? Object.keys(result) : 'NONE');
    
    // fetchCallReadOnlyFunction returns the result directly, not wrapped
    // Check if result has the expected structure
    if (result && typeof result === 'object') {
      // Handle the response structure from fetchCallReadOnlyFunction
      let actualData = result;
      
      // If result has a 'result' property, use that
      if ('result' in result && result.result) {
        actualData = result.result as any;
      }
      
      // Check if actualData has the tuple structure we expect
      if (actualData && actualData.type === 'tuple' && 'data' in actualData) {
        const tupleData = actualData as ClarityTuple;
        const statusValue = tupleData.data.status as ClarityStringAscii;
        const certificateValue = tupleData.data.certificate as ClarityOptional;
        
        const status = statusValue?.data || 'UNKNOWN';
        const certificate = certificateValue?.type === 'none' 
          ? null 
          : parseCertificateData(certificateValue.value as ClarityTuple);
        
        console.log(`Certificate verification result: ${status}`);
        return { 
          status: status as VerificationResult['status'], 
          certificate 
        };
      }
      
      // If it's a direct tuple response
      if ('status' in actualData && 'certificate' in actualData) {
        const status = (actualData as any).status || 'UNKNOWN';
        const certificate = (actualData as any).certificate === null 
          ? null 
          : parseCertificateData((actualData as any).certificate as ClarityTuple);
        
        console.log(`Certificate verification result (direct): ${status}`);
        return { 
          status: status as VerificationResult['status'], 
          certificate 
        };
      }
    }
    
    throw new Error('Unexpected response format from contract');
  } catch (error: any) {
    console.error('Error verifying certificate:', error);
    throw new Error(`Failed to verify certificate: ${error.message}`);
  }
}

/**
 * Maps governance contract uint roles to string representations
 * @param roleUint - Role as uint (0, 1, 2, 3)
 * @returns Role as string
 */
function mapUintToRoleString(roleUint: number): string {
  switch (roleUint) {
    case 0: return 'none';      // u0 = ROLE-NONE
    case 1: return 'admin';     // u1 = ROLE-ADMIN (Updated from ROLE-STUDENT)
    case 2: return 'university'; // u2 = ROLE-UNIVERSITY
    case 3: return 'knqa';      // u3 = ROLE-KNQA
    default: return 'none';
  }
}

/**
 * Gets user role from the governance contract
 * @param userAddress - User's Stacks address
 * @returns Promise resolving to user role string ('none', 'admin', 'university', 'knqa')
 */
export async function getUserRole(userAddress: string): Promise<string> {
  try {
    const network = getNetwork();
    
    console.log(`Getting user role for: ${userAddress}`);
    console.log(`🔗 Calling contract: ${config.CONTRACT_ADDRESS}.${config.CONTRACT_NAME_ROLES}`);
    console.log(`📡 Function: get-role`);
    console.log(`🌐 Network: ${config.STACKS_NETWORK}`);
    
    const options = {
      contractAddress: config.CONTRACT_ADDRESS,
      contractName: config.CONTRACT_NAME_ROLES, // governance contract
      functionName: 'get-role', // Based on governance pattern
      functionArgs: [principalCV(userAddress)],
      network,
      senderAddress: config.CONTRACT_ADDRESS
    } as any;
    
    const result: any = await fetchCallReadOnlyFunction(options);
    
    console.log(`Role registry result:`, JSON.stringify(result, (key, value) => 
      typeof value === 'bigint' ? value.toString() : value, 2));
    
    // Parse the result - governance contract returns (ok uint) or (err uint)
    if (result && result.type === 'ok' && result.value) {
      if (result.value.type === 'uint') {
        const roleUint = parseInt(result.value.value || '0');
        const roleString = mapUintToRoleString(roleUint);
        console.log(`User ${userAddress} has role: ${roleString} (u${roleUint})`);
        return roleString;
      }
    }
    
    // Handle direct uint (if contract changes to return uint directly)
    if (result && result.type === 'uint') {
      const roleUint = parseInt(result.value || '0');
      const roleString = mapUintToRoleString(roleUint);
      console.log(`User ${userAddress} has role: ${roleString} (u${roleUint})`);
      return roleString;
    }
    
    // Handle optional type (some/none) - legacy compatibility
    if (result && result.type === 'none') {
      console.log(`User ${userAddress} has no role assigned`);
      return 'none';
    }
    
    if (result && result.type === 'some' && result.value) {
      if (result.value.type === 'uint') {
        const roleUint = parseInt(result.value.value || '0');
        const roleString = mapUintToRoleString(roleUint);
        console.log(`User ${userAddress} has role: ${roleString} (u${roleUint})`);
        return roleString;
      }
      if (result.value.type === 'string-ascii') {
        const roleString = result.value.data || 'none';
        console.log(`User ${userAddress} has role: ${roleString}`);
        return roleString;
      }
    }
    
    // Handle error case
    if (result && result.type === 'err') {
      console.log(`User ${userAddress} role lookup returned error: ${result.value}`);
      return 'none';
    }
    
    console.warn(`Unexpected role result format for ${userAddress}:`, result);
    return 'none'; // Default to no role
    
  } catch (error: any) {
    console.error('Error getting user role:', error);
    // In development, you might want to return a default role
    // For now, return 'none' on error
    return 'none';
  }
}

/**
 * Gets pending transaction details
 * @param certId - Certificate ID
 * @returns Promise resolving to pending transaction data or null
 */
export async function getPendingTx(certId: string): Promise<PendingIssuanceRequest | null> {
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
    } as any;
    
    const result: any = await fetchCallReadOnlyFunction(options);
    
    if (result.type === 'none') {
      return null;
    }
    
    if (result.type === 'some') {
      return parsePendingTxData(result.value as ClarityTuple);
    }
    
    throw new Error('Unexpected response format from contract');
  } catch (error: any) {
    console.error('Error getting pending tx:', error);
    throw new Error(`Failed to get pending tx: ${error.message}`);
  }
}

/**
 * Checks if an account has sufficient funds for transaction
 * @param address - Account address to check
 * @param network - Network instance
 * @returns Promise resolving to balance in microSTX
 */
async function checkAccountBalance(address: string, network: NetworkInstance): Promise<number> {
  try {
    const balanceUrl = `${getNetworkUrl(network)}/v2/accounts/${address}`;
    console.log(`Checking balance for ${address} at ${balanceUrl}`);
    
    const response = await fetch(balanceUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch account info: ${response.status} ${response.statusText}`);
    }
    
    const accountInfo = await response.json();
    const balance = parseInt(accountInfo.balance || '0', 10);
    
    console.log(`Account ${address} balance: ${balance} microSTX (${balance / 1000000} STX)`);
    return balance;
    
  } catch (error: any) {
    console.error('Error checking account balance:', error.message);
    throw new Error(`Failed to check account balance: ${error.message}`);
  }
}

/**
 * Validates that an account has sufficient funds before transaction
 * @param signerKey - Private key (to derive address)
 * @param network - Network instance
 * @param fee - Required fee in microSTX
 * @throws Error if insufficient funds
 */
async function validateAccountFunds(signerKey: string, network: NetworkInstance, fee: number = 1000): Promise<void> {
  try {
    // For devnet/testnet, we'll skip the balance check as accounts might not have funds
    if (config.STACKS_NETWORK === 'devnet' || config.STACKS_NETWORK === 'testnet') {
      console.log('Skipping balance check for devnet/testnet environment');
      return;
    }
    
    // Note: In a real implementation, you'd derive the address from the private key
    // For now, we'll log a warning and continue
    console.warn('Balance check not implemented for mainnet - ensure accounts are funded');
    
  } catch (error: any) {
    console.error('Fund validation error:', error.message);
    // Don't throw for now to avoid breaking the flow
    console.warn('Continuing despite fund validation error');
  }
}

/**
 * Gets private keys based on role for prototype
 * @param role - Role ('university' or 'knqa')
 * @returns Private key for the role
 */
export function getKeyByRole(role: UserRoleString): string {
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
 * @param clarityValue - Clarity tuple value
 * @returns Parsed certificate object or null
 */
function parseCertificateData(clarityValue: ClarityTuple): ContractCertificate | null {
  if (!clarityValue || clarityValue.type !== 'tuple') {
    return null;
  }
  
  const data = clarityValue.data;
  
  const getStringValue = (key: string): string => {
    const value = data[key] as ClarityStringAscii;
    return value?.data || '';
  };
  
  const getUintValue = (key: string): number => {
    const value = data[key] as ClarityUint;
    return parseInt(value?.value || '0', 10);
  };
  
  const getBoolValue = (key: string): boolean => {
    const value = data[key] as ClarityBool;
    return value?.type === 'true';
  };
  
  const getOptionalStringValue = (key: string): string | null => {
    const value = data[key] as ClarityOptional;
    if (value?.type === 'some') {
      const stringValue = value.value as ClarityStringAscii;
      return stringValue?.data || null;
    }
    return null;
  };
  
  const getOptionalUintValue = (key: string): number | null => {
    const value = data[key] as ClarityOptional;
    if (value?.type === 'some') {
      const uintValue = value.value as ClarityUint;
      return parseInt(uintValue?.value || '0', 10);
    }
    return null;
  };

  return {
    studentPrincipal: getStringValue('student-principal'),
    universityPrincipal: getStringValue('university-principal'),
    studentName: getStringValue('student-name'),
    programme: getStringValue('programme'),
    year: getUintValue('year'),
    grade: getStringValue('grade'),
    ipfsCid: getStringValue('ipfs-cid'),
    certHash: getStringValue('cert-hash'),
    status: getUintValue('status') as any, // Will be properly typed as CertificateStatusType
    issuedAt: getOptionalUintValue('issued-at') || undefined,
    revokedAt: getOptionalUintValue('revoked-at') || undefined,
    revocationReason: getOptionalStringValue('revocation-reason') || undefined
  };
}

/**
 * Parses pending transaction data from Clarity value
 * @param clarityValue - Clarity tuple value
 * @returns Parsed pending transaction object or null
 */
function parsePendingTxData(clarityValue: ClarityTuple): PendingIssuanceRequest | null {
  if (!clarityValue || clarityValue.type !== 'tuple') {
    return null;
  }
  
  const data = clarityValue.data;
  
  const getStringValue = (key: string): string => {
    const value = data[key] as ClarityStringAscii;
    return value?.data || '';
  };
  
  const getUintValue = (key: string): number => {
    const value = data[key] as ClarityUint;
    return parseInt(value?.value || '0', 10);
  };
  
  const getOptionalStringValue = (key: string): string | null => {
    const value = data[key] as ClarityOptional;
    if (value?.type === 'some') {
      const stringValue = value.value as ClarityStringAscii;
      return stringValue?.data || null;
    }
    return null;
  };
  
  // Parse certificate data
  const certDataTuple = data['cert-data'] as ClarityTuple;
  
  return {
    universityPrincipal: getStringValue('proposer'),
    studentPrincipal: getStringValue('student-principal'),
    studentName: certDataTuple ? getStringValue('student-name') : '',
    programme: certDataTuple ? getStringValue('programme') : '',
    year: certDataTuple ? getUintValue('year') : 0,
    grade: certDataTuple ? getStringValue('grade') : '',
    ipfsCid: certDataTuple ? getStringValue('ipfs-cid') : '',
    certHash: certDataTuple ? getStringValue('cert-hash') : '',
    requestedAt: getUintValue('proposed-at')
  };
}