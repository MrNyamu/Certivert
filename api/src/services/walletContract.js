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
const { STACKS_TESTNET, STACKS_DEVNET, STACKS_MAINNET } = StacksNetwork;
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
 * Enhanced contract service that supports both server-side and wallet-based authentication
 */
export class WalletContractService {
  constructor(useWalletAuth = false) {
    this.useWalletAuth = useWalletAuth;
    this.network = getNetwork();
  }

  /**
   * Verify user role on-chain before allowing operations
   * @param {string} walletAddress - User's wallet address
   * @returns {Promise<string|null>} - User role or null if not found
   */
  async verifyRoleOnChain(walletAddress) {
    try {
      console.log(`Verifying role for address: ${walletAddress}`);
      
      const options = {
        contractAddress: config.CONTRACT_ADDRESS,
        contractName: config.CONTRACT_NAME_ROLES,
        functionName: 'get-role',
        functionArgs: [standardPrincipalCV(walletAddress)],
        network: this.network,
        senderAddress: walletAddress
      };
      
      const result = await makeReadOnlyContractCall(options);
      
      if (result.type === 'some') {
        const role = result.value.data;
        console.log(`Role verified: ${role} for address: ${walletAddress}`);
        return role;
      }
      
      console.log(`No role found for address: ${walletAddress}`);
      return null;
    } catch (error) {
      console.error('Role verification failed:', error);
      return null;
    }
  }

  /**
   * Create transaction options for contract calls
   * @param {string} functionName - Contract function name
   * @param {Array} functionArgs - Function arguments
   * @param {string} signerKey - Private key (for server-side signing)
   * @param {string} userAddress - User address (for wallet signing)
   * @returns {Object} Transaction options
   */
  createTxOptions(functionName, functionArgs, signerKey = null, userAddress = null) {
    const baseOptions = {
      contractAddress: config.CONTRACT_ADDRESS,
      contractName: config.CONTRACT_NAME_CERTS,
      functionName,
      functionArgs,
      network: this.network,
      anchorMode: 1,
      fee: 1000
    };

    if (this.useWalletAuth && userAddress) {
      // For wallet-based authentication - no private key needed
      return {
        ...baseOptions,
        senderAddress: userAddress
      };
    } else if (signerKey) {
      // For server-side signing
      return {
        ...baseOptions,
        senderKey: signerKey
      };
    } else {
      throw new Error('Either signerKey or userAddress must be provided');
    }
  }

  /**
   * Propose certificate with role verification
   * @param {string} certId - Certificate ID
   * @param {Object} certData - Certificate data
   * @param {string} ipfsCid - IPFS Content ID
   * @param {string} signerKey - Private key (server-side) or null (wallet-side)
   * @param {string} userAddress - User wallet address (for role verification)
   * @returns {Promise<string>} Transaction ID or unsigned transaction
   */
  async proposeCertificate(certId, certData, ipfsCid, signerKey = null, userAddress = null) {
    try {
      // Verify user has university role if using wallet auth
      if (this.useWalletAuth && userAddress) {
        const userRole = await this.verifyRoleOnChain(userAddress);
        if (userRole !== 'university') {
          throw new Error(`Access denied: University role required, found: ${userRole}`);
        }
      }

      console.log(`Proposing certificate: ${certId}`);
      console.log(`Auth method: ${this.useWalletAuth ? 'WALLET' : 'SERVER'}`);
      
      const functionArgs = [
        stringAsciiCV(certId),
        stringAsciiCV(certData.studentName),
        stringAsciiCV(certData.admissionNo),
        stringAsciiCV(certData.programme),
        uintCV(certData.year),
        stringAsciiCV(certData.grade),
        stringAsciiCV(ipfsCid),
        stringAsciiCV(certData.certHash)
      ];

      const txOptions = this.createTxOptions(
        'propose-certificate',
        functionArgs,
        signerKey,
        userAddress
      );
      
      if (this.useWalletAuth) {
        // Return transaction options for wallet signing
        console.log(`Returning transaction options for wallet signing`);
        return txOptions;
      } else {
        // Server-side signing and broadcasting
        const transaction = await makeContractCall(txOptions);
        
        // Validate transaction object
        if (!transaction || typeof transaction.serialize !== 'function') {
          console.error('Invalid transaction object:', {
            transaction: transaction,
            signerKey: signerKey ? 'PROVIDED' : 'MISSING'
          });
          throw new Error('Failed to create valid transaction object');
        }
        
        console.log(`Transaction created successfully for cert: ${certId}`);
        const result = await broadcastTransaction(transaction, this.network);
        
        console.log(`Propose transaction broadcast: ${result.txid}`);
        return result.txid;
      }
    } catch (error) {
      console.error('Error proposing certificate:', error);
      throw new Error(`Failed to propose certificate: ${error.message}`);
    }
  }

  /**
   * Approve certificate with role verification
   * @param {string} certId - Certificate ID
   * @param {string} signerKey - Private key (server-side) or null (wallet-side)
   * @param {string} userAddress - User wallet address (for role verification)
   * @returns {Promise<string>} Transaction ID or unsigned transaction
   */
  async approveCertificate(certId, signerKey = null, userAddress = null) {
    try {
      // Verify user has knqa role if using wallet auth
      if (this.useWalletAuth && userAddress) {
        const userRole = await this.verifyRoleOnChain(userAddress);
        if (userRole !== 'knqa') {
          throw new Error(`Access denied: KNQA role required, found: ${userRole}`);
        }
      }

      console.log(`Approving certificate: ${certId}`);
      console.log(`Auth method: ${this.useWalletAuth ? 'WALLET' : 'SERVER'}`);
      
      const functionArgs = [stringAsciiCV(certId)];
      const txOptions = this.createTxOptions(
        'approve-certificate',
        functionArgs,
        signerKey,
        userAddress
      );
      
      if (this.useWalletAuth) {
        // Return transaction options for wallet signing
        console.log(`Returning transaction options for wallet signing`);
        return txOptions;
      } else {
        // Server-side signing and broadcasting
        const transaction = await makeContractCall(txOptions);
        
        // Validate transaction object
        if (!transaction || typeof transaction.serialize !== 'function') {
          console.error('Invalid transaction object:', {
            transaction: transaction,
            signerKey: signerKey ? 'PROVIDED' : 'MISSING'
          });
          throw new Error('Failed to create valid transaction object');
        }
        
        console.log(`Approve transaction created successfully for cert: ${certId}`);
        const result = await broadcastTransaction(transaction, this.network);
        
        console.log(`Approve transaction broadcast: ${result.txid}`);
        return result.txid;
      }
    } catch (error) {
      console.error('Error approving certificate:', error);
      throw new Error(`Failed to approve certificate: ${error.message}`);
    }
  }

  /**
   * Revoke certificate with role verification
   * @param {string} certId - Certificate ID
   * @param {string} signerKey - Private key (server-side) or null (wallet-side)
   * @param {string} userAddress - User wallet address (for role verification)
   * @returns {Promise<string>} Transaction ID or unsigned transaction
   */
  async revokeCertificate(certId, signerKey = null, userAddress = null) {
    try {
      // Verify user has university or knqa role if using wallet auth
      if (this.useWalletAuth && userAddress) {
        const userRole = await this.verifyRoleOnChain(userAddress);
        if (userRole !== 'university' && userRole !== 'knqa') {
          throw new Error(`Access denied: University or KNQA role required, found: ${userRole}`);
        }
      }

      console.log(`Revoking certificate: ${certId}`);
      console.log(`Auth method: ${this.useWalletAuth ? 'WALLET' : 'SERVER'}`);
      
      const functionArgs = [stringAsciiCV(certId)];
      const txOptions = this.createTxOptions(
        'revoke-certificate',
        functionArgs,
        signerKey,
        userAddress
      );
      
      if (this.useWalletAuth) {
        // Return transaction options for wallet signing
        console.log(`Returning transaction options for wallet signing`);
        return txOptions;
      } else {
        // Server-side signing and broadcasting
        const transaction = await makeContractCall(txOptions);
        
        // Validate transaction object
        if (!transaction || typeof transaction.serialize !== 'function') {
          console.error('Invalid transaction object:', {
            transaction: transaction,
            signerKey: signerKey ? 'PROVIDED' : 'MISSING'
          });
          throw new Error('Failed to create valid transaction object');
        }
        
        console.log(`Revoke transaction created successfully for cert: ${certId}`);
        const result = await broadcastTransaction(transaction, this.network);
        
        console.log(`Revoke transaction broadcast: ${result.txid}`);
        return result.txid;
      }
    } catch (error) {
      console.error('Error revoking certificate:', error);
      throw new Error(`Failed to revoke certificate: ${error.message}`);
    }
  }

  /**
   * Verify certificate (read-only, no authentication needed)
   * @param {string} certId - Certificate ID
   * @returns {Promise<{status: string, certificate: Object|null}>}
   */
  async verifyCertificate(certId) {
    try {
      console.log(`Verifying certificate: ${certId}`);
      
      const options = {
        contractAddress: config.CONTRACT_ADDRESS,
        contractName: config.CONTRACT_NAME_CERTS,
        functionName: 'verify-certificate',
        functionArgs: [stringAsciiCV(certId)],
        network: this.network,
        senderAddress: config.CONTRACT_ADDRESS
      };
      
      const result = await makeReadOnlyContractCall(options);
      
      // Parse the result
      if (result.type === 'tuple') {
        const status = result.data.status?.data || 'UNKNOWN';
        const certificate = result.data.certificate?.type === 'none' 
          ? null 
          : this.parseCertificateData(result.data.certificate.value);
        
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
   * Parse certificate data from Clarity value
   * @param {Object} clarityValue - Clarity tuple value
   * @returns {Object} - Parsed certificate object
   */
  parseCertificateData(clarityValue) {
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
   * Get private key by role (for server-side signing only)
   * @param {string} role - Role name
   * @returns {string} Private key
   */
  getKeyByRole(role) {
    if (this.useWalletAuth) {
      throw new Error('getKeyByRole is not available in wallet authentication mode');
    }
    
    switch (role) {
      case 'university':
        return config.DEPLOYER_PRIVATE_KEY;
      case 'knqa':
        return config.SIGNER_2_PRIVATE_KEY;
      default:
        throw new Error(`Invalid role: ${role}`);
    }
  }
}

// Export factory functions
export function createServerSideContractService() {
  return new WalletContractService(false);
}

export function createWalletContractService() {
  return new WalletContractService(true);
}