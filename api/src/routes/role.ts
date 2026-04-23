/**
 * Role Management Routes
 * Handles user role queries and assignments
 */

import express, { type Router } from 'express';
import type { Request, Response } from 'express';
// @ts-ignore - JS imports in mixed project
import { getUserRole } from '../services/contract.js';
// @ts-ignore - JS imports in mixed project  
import { createError } from '../middleware/errorHandler.js';
import type { ApiResponse } from '../types/index.js';

const router: Router = express.Router();

// Address validation regex for Stacks addresses (38-39 chars after ST/SP prefix)
const STACKS_ADDRESS_REGEX = /^S[TP][0-9A-Z]{38,39}$/;

interface RoleResponse extends ApiResponse {
  address?: string;
  role?: string;
  permissions?: string[];
  timestamp?: string;
  network?: string;
}

interface QuickRoleResponse extends ApiResponse {
  role?: string;
  address?: string;
}

/**
 * GET /api/role/:address
 * Get user role for a specific wallet address
 */
router.get('/:address', async (req: Request<{ address: string }>, res: Response<RoleResponse>) => {
  const { address } = req.params;

  // Validate address format
  if (!address || !STACKS_ADDRESS_REGEX.test(address.toUpperCase())) {
    return res.status(400).json({
      success: false,
      error: 'Invalid wallet address format',
      message: 'Address must be a valid Stacks address (ST... or SP...)'
    });
  }

  try {
    console.log(`🔍 Fetching role for address: ${address}`);

    // Get role from blockchain contract - getUserRole returns a string directly
    const role = await getUserRole(address);
    console.log(`✅ Role found for ${address}: ${role}`);

    // Map role to permissions
    const permissions = getRolePermissions(role);

    res.json({
      success: true,
      address: address.toUpperCase(),
      role: role,
      permissions: permissions,
      timestamp: new Date().toISOString(),
      network: process.env.STACKS_NETWORK || 'devnet'
    });

  } catch (error) {
    console.error(`💥 Error fetching role for ${address}:`, error);
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to fetch user role from blockchain'
    });
  }
});

/**
 * GET /api/role/check/:address
 * Quick role check - just returns role name
 */
router.get('/check/:address', async (req: Request<{ address: string }>, res: Response<QuickRoleResponse>) => {
  const { address } = req.params;

  if (!address || !STACKS_ADDRESS_REGEX.test(address.toUpperCase())) {
    return res.status(400).json({
      success: false,
      error: 'Invalid address format'
    });
  }

  try {
    const role = await getUserRole(address);
    
    res.json({
      success: true,
      role: role || 'none',
      address: address.toUpperCase()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to check role',
      role: 'none'
    });
  }
});

/**
 * Helper function to get permissions for a role
 */
function getRolePermissions(role: string | undefined): string[] {
  switch (role?.toLowerCase()) {
    case 'admin':
      return [
        'manage_user_roles',
        'view_all_certificates',
        'verify_certificates',
        'system_administration',
        'governance_operations'
      ];
    
    case 'university':
      return [
        'issue_certificates',
        'revoke_certificates',
        'view_issued_certificates',
        'verify_certificates',
        'download_certificates',
        'upload_files'
      ];
    
    case 'knqa':
      return [
        'issue_certificates',
        'approve_certificates', 
        'revoke_certificates',
        'view_all_certificates',
        'verify_certificates',
        'download_certificates',
        'manage_users',
        'system_administration',
        'audit_activities',
        'manage_universities'
      ];
    
    default:
      return ['verify_certificates']; // Public access
  }
}

export default router;