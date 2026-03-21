import { Cl } from '@stacks/transactions';
import { initSimnet } from '@stacks/clarinet-sdk';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { config } from '../config.js';

// Simnet instance - will be initialized once
let simnet = null;
let accounts = null;

/**
 * Initialize the simnet instance with contracts
 * This is called once when the API starts in simnet mode
 */
export async function initializeSimnet() {
  if (simnet) {
    return simnet;
  }

  try {
    console.log('Initializing simnet...');
    
    // Initialize simnet - use relative path approach
    const originalCwd = process.cwd();
    const projectPath = resolve(originalCwd, '../');
    
    console.log(`Current working directory: ${originalCwd}`);
    console.log(`Project path: ${projectPath}`);
    console.log(`Clarinet.toml exists: ${existsSync(projectPath + '/Clarinet.toml')}`);
    
    // Change to project directory before initializing simnet
    process.chdir(projectPath);
    
    try {
      // Initialize simnet with current directory (after changing to project root)
      simnet = await initSimnet();
    } finally {
      // Restore original working directory
      process.chdir(originalCwd);
    }
    accounts = simnet.getAccounts();
    
    // Set up roles like in the tests
    setupRoles();
    
    console.log('Simnet initialized successfully');
    console.log(`Available accounts: ${Array.from(accounts.keys()).join(', ')}`);
    
    return simnet;
  } catch (error) {
    console.error('Failed to initialize simnet:', error);
    throw new Error(`Simnet initialization failed: ${error.message}`);
  }
}

/**
 * Set up roles for the accounts (mirroring test setup)
 */
function setupRoles() {
  const deployer = accounts.get('deployer');
  const university = accounts.get('wallet_1');
  const knqa = accounts.get('wallet_2');
  const signer2 = accounts.get('wallet_3');
  const student = accounts.get('wallet_4');
  
  // Assign roles
  simnet.callPublicFn(
    'role-registry',
    'assign-role',
    [Cl.principal(university), Cl.stringAscii('university')],
    deployer
  );
  
  simnet.callPublicFn(
    'role-registry',
    'assign-role',
    [Cl.principal(knqa), Cl.stringAscii('knqa')],
    deployer
  );
  
  simnet.callPublicFn(
    'role-registry',
    'assign-role',
    [Cl.principal(student), Cl.stringAscii('student')],
    deployer
  );
  
  // Add authorized signer
  simnet.callPublicFn(
    'certificate-store',
    'add-authorised-signer',
    [Cl.principal(signer2)],
    deployer
  );
  
  console.log('Roles set up successfully');
}

/**
 * Get account by role for simnet operations
 */
function getAccountByRole(role) {
  switch (role) {
    case 'university':
      return accounts.get('wallet_1');
    case 'knqa':
      return accounts.get('wallet_2');
    case 'signer2':
      return accounts.get('wallet_3');
    case 'student':
      return accounts.get('wallet_4');
    case 'deployer':
      return accounts.get('deployer');
    default:
      throw new Error(`Unknown role: ${role}`);
  }
}

/**
 * Proposes a certificate for issuance (simnet version)
 * @param {string} certId - Certificate ID (SHA-256 hash)
 * @param {Object} certData - Certificate data
 * @param {string} ipfsCid - IPFS Content ID
 * @param {string} role - Role of the proposer ('university')
 * @returns {Promise<string>} - Mock transaction ID
 */
export async function proposeCertificate(certId, certData, ipfsCid, role = 'university') {
  try {
    if (!simnet) {
      await initializeSimnet();
    }
    
    const proposer = getAccountByRole(role);
    
    console.log(`[SIMNET] Proposing certificate: ${certId}`);
    
    const { result } = simnet.callPublicFn(
      'certificate-store',
      'propose-certificate',
      [
        Cl.stringAscii(certId),
        Cl.stringAscii(certData.studentName),
        Cl.stringAscii(certData.admissionNo),
        Cl.stringAscii(certData.programme),
        Cl.uint(certData.year),
        Cl.stringAscii(certData.grade),
        Cl.stringAscii(ipfsCid),
        Cl.stringAscii(certData.certHash)
      ],
      proposer
    );
    
    console.log(`[SIMNET] Propose result:`, result);
    
    if (result.type === 'ok') {
      const success = result.value;
      if (success.type === 'true' || (success.type === 'bool' && success.value === true)) {
        const mockTxId = `simnet_propose_${certId}_${Date.now()}`;
        console.log(`[SIMNET] Certificate proposed successfully: ${mockTxId}`);
        return mockTxId;
      }
    } else if (result.type === 'err') {
      console.log(`[SIMNET] Propose error:`, result.value);
      const errorCode = result.value.value;
      throw new Error(`Propose certificate failed: Error code ${errorCode}`);
    }
    
    throw new Error('Propose certificate failed in simnet');
  } catch (error) {
    console.error('[SIMNET] Error proposing certificate:', error);
    throw new Error(`Failed to propose certificate: ${error.message}`);
  }
}

/**
 * Approves a certificate (completes 2-of-2 threshold)
 * @param {string} certId - Certificate ID
 * @param {string} role - Role of the approver ('signer2')
 * @returns {Promise<string>} - Mock transaction ID
 */
export async function approveCertificate(certId, role = 'signer2') {
  try {
    if (!simnet) {
      await initializeSimnet();
    }
    
    const approver = getAccountByRole(role);
    
    console.log(`[SIMNET] Approving certificate: ${certId}`);
    
    const { result } = simnet.callPublicFn(
      'certificate-store',
      'approve-certificate',
      [Cl.stringAscii(certId)],
      approver
    );
    
    console.log(`[SIMNET] Approve result:`, result);
    
    if (result.type === 'ok') {
      const success = result.value;
      if (success.type === 'true' || (success.type === 'bool' && success.value === true)) {
        const mockTxId = `simnet_approve_${certId}_${Date.now()}`;
        console.log(`[SIMNET] Certificate approved successfully: ${mockTxId}`);
        return mockTxId;
      }
    } else if (result.type === 'error') {
      console.log(`[SIMNET] Approve error:`, result.value);
      throw new Error(`Approve certificate failed: ${result.value.value || result.value}`);
    }
    
    throw new Error('Approve certificate failed in simnet');
  } catch (error) {
    console.error('[SIMNET] Error approving certificate:', error);
    throw new Error(`Failed to approve certificate: ${error.message}`);
  }
}

/**
 * Revokes a certificate
 * @param {string} certId - Certificate ID
 * @param {string} role - Role of the revoker ('university' or 'knqa')
 * @returns {Promise<string>} - Mock transaction ID
 */
export async function revokeCertificate(certId, role) {
  try {
    if (!simnet) {
      await initializeSimnet();
    }
    
    const revoker = getAccountByRole(role);
    
    console.log(`[SIMNET] Revoking certificate: ${certId}`);
    
    const { result } = simnet.callPublicFn(
      'certificate-store',
      'revoke-certificate',
      [Cl.stringAscii(certId)],
      revoker
    );
    
    console.log(`[SIMNET] Revoke result:`, result);
    
    if (result.type === 'ok') {
      const success = result.value;
      if (success.type === 'true' || (success.type === 'bool' && success.value === true)) {
        const mockTxId = `simnet_revoke_${certId}_${Date.now()}`;
        console.log(`[SIMNET] Certificate revoked successfully: ${mockTxId}`);
        return mockTxId;
      }
    } else if (result.type === 'error') {
      console.log(`[SIMNET] Revoke error:`, result.value);
      throw new Error(`Revoke certificate failed: ${result.value.value || result.value}`);
    }
    
    throw new Error('Revoke certificate failed in simnet');
  } catch (error) {
    console.error('[SIMNET] Error revoking certificate:', error);
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
    if (!simnet) {
      await initializeSimnet();
    }
    
    const deployer = accounts.get('deployer');
    
    console.log(`[SIMNET] Verifying certificate: ${certId}`);
    
    const { result } = simnet.callReadOnlyFn(
      'certificate-store',
      'verify-certificate',
      [Cl.stringAscii(certId)],
      deployer
    );
    
    console.log(`[SIMNET] Raw result:`, result);
    
    // Parse the result - it's already a JavaScript object with type and value
    try {
      if (result.type !== 'tuple' || !result.value) {
        throw new Error(`Expected tuple response, got ${result.type}`);
      }
      
      const tupleValue = result.value;
      const statusField = tupleValue['status'];
      const certificateField = tupleValue['certificate'];
      
      if (!statusField || statusField.type !== 'ascii') {
        throw new Error(`Expected status field with ascii type, got ${statusField?.type}`);
      }
      
      const status = statusField.value;
      
      let certificate = null;
      if (certificateField && certificateField.type === 'some') {
        try {
          // The certificate field is a 'some' type containing a tuple
          const certTupleValue = certificateField.value;
          certificate = parseCertificateFromSimnetValue(certTupleValue);
        } catch (e) {
          console.log(`[SIMNET] Error parsing certificate:`, e);
          certificate = null;
        }
      }
      
      console.log(`[SIMNET] Certificate verification result: ${status}`);
      return { status, certificate };
    } catch (parseError) {
      console.log(`[SIMNET] Parse error:`, parseError);
      console.log(`[SIMNET] Result type:`, result.type);
      console.log(`[SIMNET] Result value:`, result.value);
      throw new Error(`Unexpected response format from simnet contract: ${parseError.message}`);
    }
  } catch (error) {
    console.error('[SIMNET] Error verifying certificate:', error);
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
    if (!simnet) {
      await initializeSimnet();
    }
    
    const deployer = accounts.get('deployer');
    
    console.log(`[SIMNET] Getting pending tx: ${certId}`);
    
    const { result } = simnet.callReadOnlyFn(
      'certificate-store',
      'get-pending-tx',
      [Cl.stringAscii(certId)],
      deployer
    );
    
    if (result.expectNone) {
      try {
        result.expectNone();
        return null;
      } catch (e) {
        // Not none, continue to some case
      }
    }
    
    if (result.expectSome) {
      const pendingData = result.expectSome().expectTuple();
      return parsePendingTxFromSimnet(pendingData);
    }
    
    throw new Error('Unexpected response format from simnet contract');
  } catch (error) {
    console.error('[SIMNET] Error getting pending tx:', error);
    throw new Error(`Failed to get pending tx: ${error.message}`);
  }
}

/**
 * Gets private keys based on role for prototype - simnet version returns roles instead
 * @param {string} role - Role ('university' or 'knqa')
 * @returns {string} - Role identifier for simnet
 */
export function getKeyByRole(role) {
  // In simnet, we return the role to be used with getAccountByRole
  switch (role) {
    case 'university':
      return 'university';
    case 'knqa':
      return 'knqa';
    default:
      throw new Error(`Invalid role: ${role}`);
  }
}

/**
 * Parses certificate data from simnet tuple (old format with expectX methods)
 * @param {Object} certTuple - Simnet tuple result
 * @returns {Object} - Parsed certificate object
 */
function parseCertificateFromSimnet(certTuple) {
  return {
    studentName: certTuple['student-name'].expectAscii(),
    admissionNo: certTuple['admission-no'].expectAscii(),
    programme: certTuple.programme.expectAscii(),
    year: Number(certTuple.year.expectUint()),
    grade: certTuple.grade.expectAscii(),
    ipfsCid: certTuple['ipfs-cid'].expectAscii(),
    certHash: certTuple['cert-hash'].expectAscii(),
    issuedBy: certTuple['issued-by'].expectPrincipal(),
    issuedAt: Number(certTuple['issued-at'].expectUint()),
    revoked: certTuple.revoked.expectBool(),
    revokedBy: certTuple['revoked-by'].expectNone ? null : certTuple['revoked-by'].expectSome().expectPrincipal(),
    revokedAt: certTuple['revoked-at'].expectNone ? null : Number(certTuple['revoked-at'].expectSome().expectUint())
  };
}

/**
 * Parses certificate data from simnet value object (new format)
 * @param {Object} certValue - Simnet value object
 * @returns {Object} - Parsed certificate object
 */
function parseCertificateFromSimnetValue(certValue) {
  if (!certValue || certValue.type !== 'tuple' || !certValue.value) {
    throw new Error('Invalid certificate value structure');
  }
  
  const fields = certValue.value;
  
  return {
    studentName: fields['student-name']?.value,
    admissionNo: fields['admission-no']?.value,
    programme: fields['programme']?.value,
    year: Number(fields['year']?.value),
    grade: fields['grade']?.value,
    ipfsCid: fields['ipfs-cid']?.value,
    certHash: fields['cert-hash']?.value,
    issuedBy: fields['issued-by']?.value,
    issuedAt: Number(fields['issued-at']?.value),
    revoked: fields['revoked']?.value,
    revokedBy: fields['revoked-by']?.type === 'some' ? fields['revoked-by'].value : null,
    revokedAt: fields['revoked-at']?.type === 'some' ? Number(fields['revoked-at'].value) : null
  };
}

/**
 * Parses pending transaction data from simnet tuple
 * @param {Object} pendingTuple - Simnet tuple result
 * @returns {Object} - Parsed pending transaction object
 */
function parsePendingTxFromSimnet(pendingTuple) {
  const certDataTuple = pendingTuple['cert-data'].expectTuple();
  const certData = parseCertificateFromSimnet(certDataTuple);
  
  return {
    proposer: pendingTuple.proposer.expectPrincipal(),
    signer2: pendingTuple['signer-2'].expectNone ? null : pendingTuple['signer-2'].expectSome().expectPrincipal(),
    certData,
    signatures: Number(pendingTuple.signatures.expectUint()),
    proposedAt: Number(pendingTuple['proposed-at'].expectUint())
  };
}

/**
 * Get the simnet instance (for debugging or advanced usage)
 */
export function getSimnet() {
  return simnet;
}

/**
 * Get simnet accounts (for debugging or advanced usage)
 */
export function getAccounts() {
  return accounts;
}