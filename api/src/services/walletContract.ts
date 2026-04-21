import {
  makeContractCall,
  fetchCallReadOnlyFunction,
  broadcastTransaction,
  stringAsciiCV,
  principalCV,
  uintCV,
  standardPrincipalCV,
  StacksTransactionWire as StacksTransaction
} from '@stacks/transactions';

import {
  STACKS_DEVNET as StacksDevnet,
  STACKS_TESTNET as StacksTestnet,
  STACKS_MAINNET as StacksMainnet,
  StacksNetwork as BaseStacksNetwork
} from '@stacks/network';

import { config } from '../config.js';
import type {
  CertificateData,
  UserRoleString,
  VerificationResult,
  ContractCertificate
} from '../types/index.js';
import type {
  StacksNetwork,
  ContractCallOptions,
  ReadOnlyFunctionOptions,
  ClarityValue,
  ClarityTuple,
  ClarityOptional,
  ClarityUint,
  ClarityStringAscii,
  ClarityBool,
  ClarityPrincipal,
  TransactionResult
} from '../types/blockchain.js';

/**
 * Custom error class for wallet contract service errors
 */
export class WalletContractError extends Error {
  public readonly code: string;
  public readonly details?: any;

  constructor(message: string, code: string = 'WALLET_CONTRACT_ERROR', details?: any) {
    super(message);
    this.name = 'WalletContractError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Transaction options for wallet-based signing
 */
export interface WalletTransactionOptions extends Omit<ContractCallOptions, 'senderKey'> {
  senderAddress: string;
}

/**
 * Result from role verification
 */
export interface RoleVerificationResult {
  role: UserRoleString | null;
  verified: boolean;
  address: string;
}

/**
 * Certificate verification response from contract
 */
export interface ContractVerificationResult {
  status: string;
  certificate: ContractCertificate | null;
}

/**
 * Creates a network instance based on configuration
 */
function getNetwork(): BaseStacksNetwork {
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
 * Enhanced contract service that supports both server-side and wallet-based authentication
 * 
 * This service provides a unified interface for interacting with the certificate smart contracts
 * while supporting two authentication modes:
 * - Server-side: Uses private keys for signing transactions
 * - Wallet-based: Returns transaction options for external wallet signing
 */
export class WalletContractService {
  private readonly useWalletAuth: boolean;
  private readonly network: BaseStacksNetwork;

  /**
   * Creates a new WalletContractService instance
   * @param useWalletAuth - Whether to use wallet-based authentication (true) or server-side signing (false)
   */
  constructor(useWalletAuth: boolean = false) {
    this.useWalletAuth = useWalletAuth;
    this.network = getNetwork();
  }

  /**
   * Verify user role on-chain before allowing operations
   * @param walletAddress - User's wallet address
   * @returns Promise resolving to user role verification result
   * @throws WalletContractError when verification fails
   */
  async verifyRoleOnChain(walletAddress: string): Promise<RoleVerificationResult> {
    try {
      console.log(`Verifying role for address: ${walletAddress}`);
      
      const options: ReadOnlyFunctionOptions = {
        contractAddress: config.CONTRACT_ADDRESS,
        contractName: config.CONTRACT_NAME_ROLES,
        functionName: 'get-role',
        functionArgs: [standardPrincipalCV(walletAddress)],
        network: this.network,
        senderAddress: walletAddress
      };
      
      const result = await fetchCallReadOnlyFunction(options);
      
      if (result.type === 'some') {
        const roleData = (result as ClarityOptional).value?.data;
        const role = this.mapContractRoleToString(roleData);
        console.log(`Role verified: ${role} for address: ${walletAddress}`);
        
        return {
          role,
          verified: true,
          address: walletAddress
        };
      }
      
      console.log(`No role found for address: ${walletAddress}`);
      return {
        role: null,
        verified: false,
        address: walletAddress
      };
    } catch (error) {
      console.error('Role verification failed:', error);
      throw new WalletContractError(
        `Role verification failed for address ${walletAddress}`,
        'ROLE_VERIFICATION_FAILED',
        { walletAddress, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Maps contract role data to UserRoleString
   * @param roleData - Role data from contract
   * @returns Mapped role string
   */
  private mapContractRoleToString(roleData: any): UserRoleString {
    if (typeof roleData !== 'string') {
      return 'none';
    }
    
    switch (roleData.toLowerCase()) {
      case 'university':
        return 'university';
      case 'knqa':
        return 'knqa';
      case 'student':
        return 'student';
      default:
        return 'none';
    }
  }

  /**
   * Create transaction options for contract calls
   * @param functionName - Contract function name
   * @param functionArgs - Function arguments as Clarity values
   * @param signerKey - Private key for server-side signing (optional)
   * @param userAddress - User address for wallet signing (optional)
   * @returns Transaction options object
   * @throws WalletContractError when neither signerKey nor userAddress is provided
   */
  createTxOptions(
    functionName: string,
    functionArgs: ClarityValue[],
    signerKey: string | null = null,
    userAddress: string | null = null
  ): ContractCallOptions | WalletTransactionOptions {
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
      } as WalletTransactionOptions;
    } else if (signerKey) {
      // For server-side signing
      return {
        ...baseOptions,
        senderKey: signerKey
      } as ContractCallOptions;
    } else {
      throw new WalletContractError(
        'Either signerKey or userAddress must be provided',
        'MISSING_AUTHENTICATION',
        { useWalletAuth: this.useWalletAuth, signerKey: !!signerKey, userAddress: !!userAddress }
      );
    }
  }

  /**
   * Propose certificate with role verification
   * @param certId - Certificate ID
   * @param certData - Certificate data object
   * @param ipfsCid - IPFS Content ID
   * @param signerKey - Private key for server-side signing (optional)
   * @param userAddress - User wallet address for role verification (optional)
   * @returns Promise resolving to transaction ID (server-side) or transaction options (wallet-side)
   * @throws WalletContractError when role verification fails or transaction creation fails
   */
  async proposeCertificate(
    certId: string,
    certData: CertificateData,
    ipfsCid: string,
    signerKey: string | null = null,
    userAddress: string | null = null
  ): Promise<string | WalletTransactionOptions> {
    try {
      // Verify user has university role if using wallet auth
      if (this.useWalletAuth && userAddress) {
        const roleResult = await this.verifyRoleOnChain(userAddress);
        if (roleResult.role !== 'university') {
          throw new WalletContractError(
            `Access denied: University role required, found: ${roleResult.role}`,
            'INSUFFICIENT_PERMISSIONS',
            { requiredRole: 'university', actualRole: roleResult.role, userAddress }
          );
        }
      }

      console.log(`Proposing certificate: ${certId}`);
      console.log(`Auth method: ${this.useWalletAuth ? 'WALLET' : 'SERVER'}`);
      
      const functionArgs: ClarityValue[] = [
        stringAsciiCV(certId),
        stringAsciiCV(certData.studentName),
        stringAsciiCV(certData.admissionNo),
        stringAsciiCV(certData.programme),
        uintCV(certData.year),
        stringAsciiCV(certData.grade),
        stringAsciiCV(ipfsCid),
        stringAsciiCV(certData.certHash || '')
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
        return txOptions as WalletTransactionOptions;
      } else {
        // Server-side signing and broadcasting
        const transaction = await makeContractCall(txOptions as any);
        
        // Validate transaction object
        if (!transaction || typeof transaction.serialize !== 'function') {
          console.error('Invalid transaction object:', {
            transaction: !!transaction,
            signerKey: signerKey ? 'PROVIDED' : 'MISSING'
          });
          throw new WalletContractError(
            'Failed to create valid transaction object',
            'INVALID_TRANSACTION',
            { certId, hasTransaction: !!transaction }
          );
        }
        
        console.log(`Transaction created successfully for cert: ${certId}`);
        const result = await broadcastTransaction({ transaction, network: this.network });
        
        console.log(`Propose transaction broadcast: ${result.txid}`);
        return result.txid;
      }
    } catch (error) {
      console.error('Error proposing certificate:', error);
      if (error instanceof WalletContractError) {
        throw error;
      }
      throw new WalletContractError(
        `Failed to propose certificate: ${error instanceof Error ? error.message : String(error)}`,
        'PROPOSE_CERTIFICATE_FAILED',
        { certId, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Approve certificate with role verification
   * @param certId - Certificate ID
   * @param signerKey - Private key for server-side signing (optional)
   * @param userAddress - User wallet address for role verification (optional)
   * @returns Promise resolving to transaction ID (server-side) or transaction options (wallet-side)
   * @throws WalletContractError when role verification fails or transaction creation fails
   */
  async approveCertificate(
    certId: string,
    signerKey: string | null = null,
    userAddress: string | null = null
  ): Promise<string | WalletTransactionOptions> {
    try {
      // Verify user has knqa role if using wallet auth
      if (this.useWalletAuth && userAddress) {
        const roleResult = await this.verifyRoleOnChain(userAddress);
        if (roleResult.role !== 'knqa') {
          throw new WalletContractError(
            `Access denied: KNQA role required, found: ${roleResult.role}`,
            'INSUFFICIENT_PERMISSIONS',
            { requiredRole: 'knqa', actualRole: roleResult.role, userAddress }
          );
        }
      }

      console.log(`Approving certificate: ${certId}`);
      console.log(`Auth method: ${this.useWalletAuth ? 'WALLET' : 'SERVER'}`);
      
      const functionArgs: ClarityValue[] = [stringAsciiCV(certId)];
      const txOptions = this.createTxOptions(
        'approve-certificate',
        functionArgs,
        signerKey,
        userAddress
      );
      
      if (this.useWalletAuth) {
        // Return transaction options for wallet signing
        console.log(`Returning transaction options for wallet signing`);
        return txOptions as WalletTransactionOptions;
      } else {
        // Server-side signing and broadcasting
        const transaction = await makeContractCall(txOptions as any);
        
        // Validate transaction object
        if (!transaction || typeof transaction.serialize !== 'function') {
          console.error('Invalid transaction object:', {
            transaction: !!transaction,
            signerKey: signerKey ? 'PROVIDED' : 'MISSING'
          });
          throw new WalletContractError(
            'Failed to create valid transaction object',
            'INVALID_TRANSACTION',
            { certId, hasTransaction: !!transaction }
          );
        }
        
        console.log(`Approve transaction created successfully for cert: ${certId}`);
        const result = await broadcastTransaction({ transaction, network: this.network });
        
        console.log(`Approve transaction broadcast: ${result.txid}`);
        return result.txid;
      }
    } catch (error) {
      console.error('Error approving certificate:', error);
      if (error instanceof WalletContractError) {
        throw error;
      }
      throw new WalletContractError(
        `Failed to approve certificate: ${error instanceof Error ? error.message : String(error)}`,
        'APPROVE_CERTIFICATE_FAILED',
        { certId, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Revoke certificate with role verification
   * @param certId - Certificate ID
   * @param signerKey - Private key for server-side signing (optional)
   * @param userAddress - User wallet address for role verification (optional)
   * @returns Promise resolving to transaction ID (server-side) or transaction options (wallet-side)
   * @throws WalletContractError when role verification fails or transaction creation fails
   */
  async revokeCertificate(
    certId: string,
    signerKey: string | null = null,
    userAddress: string | null = null
  ): Promise<string | WalletTransactionOptions> {
    try {
      // Verify user has university or knqa role if using wallet auth
      if (this.useWalletAuth && userAddress) {
        const roleResult = await this.verifyRoleOnChain(userAddress);
        if (roleResult.role !== 'university' && roleResult.role !== 'knqa') {
          throw new WalletContractError(
            `Access denied: University or KNQA role required, found: ${roleResult.role}`,
            'INSUFFICIENT_PERMISSIONS',
            { requiredRoles: ['university', 'knqa'], actualRole: roleResult.role, userAddress }
          );
        }
      }

      console.log(`Revoking certificate: ${certId}`);
      console.log(`Auth method: ${this.useWalletAuth ? 'WALLET' : 'SERVER'}`);
      
      const functionArgs: ClarityValue[] = [stringAsciiCV(certId)];
      const txOptions = this.createTxOptions(
        'revoke-certificate',
        functionArgs,
        signerKey,
        userAddress
      );
      
      if (this.useWalletAuth) {
        // Return transaction options for wallet signing
        console.log(`Returning transaction options for wallet signing`);
        return txOptions as WalletTransactionOptions;
      } else {
        // Server-side signing and broadcasting
        const transaction = await makeContractCall(txOptions as any);
        
        // Validate transaction object
        if (!transaction || typeof transaction.serialize !== 'function') {
          console.error('Invalid transaction object:', {
            transaction: !!transaction,
            signerKey: signerKey ? 'PROVIDED' : 'MISSING'
          });
          throw new WalletContractError(
            'Failed to create valid transaction object',
            'INVALID_TRANSACTION',
            { certId, hasTransaction: !!transaction }
          );
        }
        
        console.log(`Revoke transaction created successfully for cert: ${certId}`);
        const result = await broadcastTransaction({ transaction, network: this.network });
        
        console.log(`Revoke transaction broadcast: ${result.txid}`);
        return result.txid;
      }
    } catch (error) {
      console.error('Error revoking certificate:', error);
      if (error instanceof WalletContractError) {
        throw error;
      }
      throw new WalletContractError(
        `Failed to revoke certificate: ${error instanceof Error ? error.message : String(error)}`,
        'REVOKE_CERTIFICATE_FAILED',
        { certId, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Verify certificate (read-only, no authentication needed)
   * @param certId - Certificate ID
   * @returns Promise resolving to verification result with status and certificate data
   * @throws WalletContractError when verification fails
   */
  async verifyCertificate(certId: string): Promise<ContractVerificationResult> {
    try {
      console.log(`Verifying certificate: ${certId}`);
      
      const options: ReadOnlyFunctionOptions = {
        contractAddress: config.CONTRACT_ADDRESS,
        contractName: config.CONTRACT_NAME_CERTS,
        functionName: 'verify-certificate',
        functionArgs: [stringAsciiCV(certId)],
        network: this.network,
        senderAddress: config.CONTRACT_ADDRESS
      };
      
      const result = await fetchCallReadOnlyFunction(options);
      
      // Parse the result
      if (result.type === 'tuple') {
        const tupleResult = result as ClarityTuple;
        const status = tupleResult.data.status?.data || 'UNKNOWN';
        const certificate = tupleResult.data.certificate?.type === 'none' 
          ? null 
          : this.parseCertificateData((tupleResult.data.certificate as ClarityOptional).value);
        
        console.log(`Certificate verification result: ${status}`);
        return { status, certificate };
      }
      
      throw new WalletContractError(
        'Unexpected response format from contract',
        'INVALID_CONTRACT_RESPONSE',
        { certId, resultType: result.type }
      );
    } catch (error) {
      console.error('Error verifying certificate:', error);
      if (error instanceof WalletContractError) {
        throw error;
      }
      throw new WalletContractError(
        `Failed to verify certificate: ${error instanceof Error ? error.message : String(error)}`,
        'VERIFY_CERTIFICATE_FAILED',
        { certId, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Parse certificate data from Clarity value
   * @param clarityValue - Clarity tuple value containing certificate data
   * @returns Parsed certificate object or null if invalid
   */
  private parseCertificateData(clarityValue: ClarityValue | undefined): ContractCertificate | null {
    if (!clarityValue || clarityValue.type !== 'tuple') {
      return null;
    }
    
    const data = (clarityValue as ClarityTuple).data;
    
    try {
      return {
        studentPrincipal: (data['student-principal'] as ClarityPrincipal)?.data || '',
        universityPrincipal: (data['university-principal'] as ClarityPrincipal)?.data || '',
        studentName: (data['student-name'] as ClarityStringAscii)?.data || '',
        programme: (data.programme as ClarityStringAscii)?.data || '',
        year: parseInt((data.year as ClarityUint)?.value || '0'),
        grade: (data.grade as ClarityStringAscii)?.data || '',
        ipfsCid: (data['ipfs-cid'] as ClarityStringAscii)?.data || '',
        certHash: (data['cert-hash'] as ClarityStringAscii)?.data || '',
        status: this.parseStatus((data.status as ClarityUint)?.value) as any,
        issuedAt: parseInt((data['issued-at'] as ClarityUint)?.value || '0'),
        revokedAt: (data['revoked-at'] as ClarityOptional)?.type === 'some' 
          ? parseInt(((data['revoked-at'] as ClarityOptional).value as ClarityUint)?.value || '0') 
          : undefined,
        revocationReason: (data['revocation-reason'] as ClarityOptional)?.type === 'some'
          ? ((data['revocation-reason'] as ClarityOptional).value as ClarityStringAscii)?.data
          : undefined
      };
    } catch (error) {
      console.error('Error parsing certificate data:', error);
      return null;
    }
  }

  /**
   * Parse status value from contract response
   * @param statusValue - Status value from contract
   * @returns Parsed status number
   */
  private parseStatus(statusValue: string | undefined): number {
    if (!statusValue) return 100; // Default to PENDING_ISSUE
    const parsed = parseInt(statusValue);
    return isNaN(parsed) ? 100 : parsed;
  }

  /**
   * Get private key by role (for server-side signing only)
   * @param role - Role name
   * @returns Private key for the specified role
   * @throws WalletContractError when called in wallet auth mode or for invalid role
   */
  getKeyByRole(role: UserRoleString): string {
    if (this.useWalletAuth) {
      throw new WalletContractError(
        'getKeyByRole is not available in wallet authentication mode',
        'WALLET_AUTH_MODE_RESTRICTION',
        { role }
      );
    }
    
    switch (role) {
      case 'university':
        return config.DEPLOYER_PRIVATE_KEY;
      case 'knqa':
        return config.SIGNER_2_PRIVATE_KEY;
      default:
        throw new WalletContractError(
          `Invalid role: ${role}`,
          'INVALID_ROLE',
          { role, validRoles: ['university', 'knqa'] }
        );
    }
  }

  /**
   * Get current authentication mode
   * @returns Whether wallet authentication is enabled
   */
  isWalletAuthEnabled(): boolean {
    return this.useWalletAuth;
  }

  /**
   * Get current network configuration
   * @returns Current Stacks network instance
   */
  getNetwork(): BaseStacksNetwork {
    return this.network;
  }
}

/**
 * Factory function to create a server-side contract service
 * @returns WalletContractService configured for server-side signing
 */
export function createServerSideContractService(): WalletContractService {
  return new WalletContractService(false);
}

/**
 * Factory function to create a wallet-based contract service
 * @returns WalletContractService configured for wallet-based authentication
 */
export function createWalletContractService(): WalletContractService {
  return new WalletContractService(true);
}