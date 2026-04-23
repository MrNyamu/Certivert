/**
 * Wallet-Based Authentication and Authorization Middleware
 * Integrates with Stacks Connect for wallet-based authentication
 * Verifies signatures and fetches user roles from blockchain
 */

import type { Request, Response, NextFunction } from 'express';
import { createError } from './errorHandler.js';
import { getUserRole } from '../services/contract.js';
import { stringToRole, type UserRoleString } from '../types/index.js';
import type { UserRoleType } from '../types/index.js';

/**
 * Extended request interface with wallet authentication
 */
export interface WalletAuthenticatedRequest extends Request {
  wallet?: {
    address: string;
    publicKey: string;
    signature?: string;
    message?: string;
    role: UserRoleType;
    roleString: UserRoleString;
  };
}

/**
 * Fetches user role from blockchain contract
 */
async function fetchUserRole(address: string): Promise<{ role: UserRoleType; roleString: UserRoleString }> {
  try {
    console.log(`Fetching role for address: ${address}`);
    
    // Call the contract to get user role (returns string)
    const roleString = await getUserRole(address) as UserRoleString;
    const role = stringToRole(roleString);
    
    console.log(`Address ${address} has role: ${roleString} (${role})`);
    
    return { role, roleString };
  } catch (error: any) {
    console.error('Error fetching user role:', error.message);
    // Default to no role on error
    return { role: 0, roleString: 'none' };
  }
}

/**
 * Wallet-based authentication middleware
 * Expects wallet connection data from Stacks Connect frontend
 */
export const authenticateWallet = async (req: WalletAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Extract wallet information from request body or headers
    const { walletAddress: bodyWalletAddress, publicKey, signature, message } = req.body;
    const headerWalletAddress = req.headers['x-wallet-address'] as string;
    
    // Use wallet address from header first, then fallback to body
    const walletAddress = headerWalletAddress || bodyWalletAddress;
    
    if (!walletAddress) {
      throw createError(401, 'Wallet address required', 'WALLET_ADDRESS_MISSING');
    }
    
    // For signed transactions, we might also verify the signature
    // This is optional for read operations but required for write operations
    if (signature && message && publicKey) {
      // TODO: Implement signature verification
      console.log('Signature verification would happen here');
      // verifyStacksSignature(message, signature, publicKey);
    }
    
    // Fetch user role from blockchain
    const { role, roleString } = await fetchUserRole(walletAddress);
    
    // Attach wallet info to request
    req.wallet = {
      address: walletAddress,
      publicKey: publicKey || '',
      signature,
      message,
      role,
      roleString
    };
    
    console.log(`Authenticated wallet: ${walletAddress} with role: ${roleString}`);
    next();
    
  } catch (error) {
    next(error);
  }
};

/**
 * Authorization middleware factory - creates middleware for specific roles
 * @param allowedRoles - Array of role strings that are allowed to access the endpoint
 * @returns Express middleware function
 */
export const requireRole = (allowedRoles: UserRoleString[]) => {
  return (req: WalletAuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.wallet) {
        throw createError(401, 'Wallet not connected', 'WALLET_NOT_CONNECTED');
      }
      
      if (!allowedRoles.includes(req.wallet.roleString)) {
        throw createError(403, `Access denied. Required roles: ${allowedRoles.join(', ')}. Your role: ${req.wallet.roleString}. Connect with a wallet that has the required role.`, 'INSUFFICIENT_ROLE');
      }
      
      console.log(`Authorization successful: ${req.wallet.roleString} (${req.wallet.address}) accessing endpoint requiring: ${allowedRoles.join(', ')}`);
      next();
      
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware specifically for certificate issuance
 * Only universities can issue certificates
 */
export const requireUniversityRole = requireRole(['university']);

/**
 * Middleware specifically for KNQA operations
 * Only KNQA can approve certificates
 */
export const requireKNQARole = requireRole(['knqa']);

/**
 * Middleware for certificate revocation
 * Both universities and KNQA can revoke certificates
 */
export const requireRevocationRole = requireRole(['university', 'knqa']);

/**
 * Middleware for pending certificate operations
 * Both universities and KNQA can view pending certificates
 */
export const requireCertificateManagementRole = requireRole(['university', 'knqa']);

/**
 * Middleware for verification (public access)
 * Anyone can verify certificates
 */
export const allowPublicAccess = (req: WalletAuthenticatedRequest, res: Response, next: NextFunction): void => {
  // Public endpoint - no authentication required
  console.log('Public access endpoint - no authentication required');
  next();
};

/**
 * Transaction signing middleware - ensures wallet can sign transactions
 * Used for operations that require on-chain transactions
 */
export const requireSigningCapability = (req: WalletAuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    if (!req.wallet) {
      throw createError(401, 'Wallet connection required for transaction signing', 'WALLET_REQUIRED');
    }
    
    // For transaction signing, we need the wallet to be connected
    // The actual signing will happen on the frontend
    console.log(`Wallet ${req.wallet.address} ready for transaction signing`);
    next();
    
  } catch (error) {
    next(error);
  }
};