import {
  callReadOnlyFunction,
  openContractCall,
  contractPrincipalCV,
  principalCV,
  stringAsciiCV,
  uintCV
} from '@stacks/transactions';
import { StacksTestnet, StacksDevnet } from '@stacks/network';

// Contract configuration
const CONTRACT_ADDRESS = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
const CONTRACT_NAME = 'certificate-governance';

// Network configuration
const getNetwork = () => {
  return new StacksDevnet();
};

// Role constants (must match contract)
export const ROLES = {
  NONE: 0,
  STUDENT: 1,
  UNIVERSITY: 2,
  KNQA: 3
};

export const CERTIFICATE_STATUS = {
  PENDING_ISSUE: 100,
  ACTIVE: 200,
  PENDING_REVOKE: 300,
  REVOKED: 400
};

// ===========================================
// WALLET-BASED AUTHENTICATION
// ===========================================

/**
 * Get user role from blockchain using their connected wallet address
 */
export async function getUserRole(userAddress) {
  try {
    const result = await callReadOnlyFunction({
      network: getNetwork(),
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'get-role',
      functionArgs: [principalCV(userAddress)],
      senderAddress: userAddress
    });
    
    // Extract role value from Clarity response
    const roleValue = result.value.value;
    return roleValue;
  } catch (error) {
    console.error('Error getting user role:', error);
    return ROLES.NONE;
  }
}

/**
 * Check if user has sufficient permissions for an action
 */
export function canUserPerformAction(userRole, action) {
  switch (action) {
    case 'REQUEST_ISSUE':
      return userRole === ROLES.UNIVERSITY;
    case 'APPROVE_ISSUE':
      return userRole === ROLES.KNQA;
    case 'REQUEST_REVOKE':
      return userRole === ROLES.UNIVERSITY || userRole === ROLES.KNQA;
    case 'APPROVE_REVOKE':
      return userRole === ROLES.UNIVERSITY || userRole === ROLES.KNQA;
    case 'VIEW_CERTIFICATE':
      return true; // Anyone can view
    default:
      return false;
  }
}

// ===========================================
// CERTIFICATE ISSUANCE WORKFLOW
// ===========================================

/**
 * Step 1: University requests certificate issuance
 */
export async function requestIssueCertificate({
  certId,
  studentAddress,
  studentName,
  programme,
  year,
  grade,
  ipfsCid,
  certHash
}) {
  const functionArgs = [
    stringAsciiCV(certId),
    principalCV(studentAddress),
    stringAsciiCV(studentName),
    stringAsciiCV(programme),
    uintCV(year),
    stringAsciiCV(grade),
    stringAsciiCV(ipfsCid),
    stringAsciiCV(certHash)
  ];

  return await openContractCall({
    network: getNetwork(),
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'request-issue-certificate',
    functionArgs,
    onFinish: (data) => {
      console.log('Certificate issuance requested:', data);
    },
    onCancel: () => {
      console.log('Certificate issuance cancelled');
    }
  });
}

/**
 * Step 2: KNQA approves certificate issuance
 */
export async function approveIssueCertificate(certId) {
  const functionArgs = [stringAsciiCV(certId)];

  return await openContractCall({
    network: getNetwork(),
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'approve-issue-certificate',
    functionArgs,
    onFinish: (data) => {
      console.log('Certificate issuance approved:', data);
    },
    onCancel: () => {
      console.log('Certificate approval cancelled');
    }
  });
}

// ===========================================
// CERTIFICATE REVOCATION WORKFLOW
// ===========================================

/**
 * Step 1: University or KNQA requests revocation
 */
export async function requestRevokeCertificate(certId, reason) {
  const functionArgs = [
    stringAsciiCV(certId),
    stringAsciiCV(reason)
  ];

  return await openContractCall({
    network: getNetwork(),
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'request-revoke-certificate',
    functionArgs,
    onFinish: (data) => {
      console.log('Certificate revocation requested:', data);
    },
    onCancel: () => {
      console.log('Certificate revocation cancelled');
    }
  });
}

/**
 * Step 2: Other party approves revocation
 */
export async function approveRevokeCertificate(certId) {
  const functionArgs = [stringAsciiCV(certId)];

  return await openContractCall({
    network: getNetwork(),
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'approve-revoke-certificate',
    functionArgs,
    onFinish: (data) => {
      console.log('Certificate revocation approved:', data);
    },
    onCancel: () => {
      console.log('Certificate revocation approval cancelled');
    }
  });
}

// ===========================================
// READ-ONLY FUNCTIONS (Public Verification)
// ===========================================

/**
 * Get certificate details
 */
export async function getCertificate(certId) {
  try {
    const result = await callReadOnlyFunction({
      network: getNetwork(),
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'get-certificate',
      functionArgs: [stringAsciiCV(certId)],
      senderAddress: CONTRACT_ADDRESS
    });
    
    return result.value;
  } catch (error) {
    console.error('Error getting certificate:', error);
    return null;
  }
}

/**
 * Check if certificate is valid
 */
export async function isCertificateValid(certId) {
  try {
    const result = await callReadOnlyFunction({
      network: getNetwork(),
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'is-certificate-valid',
      functionArgs: [stringAsciiCV(certId)],
      senderAddress: CONTRACT_ADDRESS
    });
    
    return result.value.value === true;
  } catch (error) {
    console.error('Error checking certificate validity:', error);
    return false;
  }
}

/**
 * Get pending issuance request
 */
export async function getPendingIssuance(certId) {
  try {
    const result = await callReadOnlyFunction({
      network: getNetwork(),
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'get-pending-issuance',
      functionArgs: [stringAsciiCV(certId)],
      senderAddress: CONTRACT_ADDRESS
    });
    
    return result.value;
  } catch (error) {
    console.error('Error getting pending issuance:', error);
    return null;
  }
}

/**
 * Get pending revocation request
 */
export async function getPendingRevocation(certId) {
  try {
    const result = await callReadOnlyFunction({
      network: getNetwork(),
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'get-pending-revocation',
      functionArgs: [stringAsciiCV(certId)],
      senderAddress: CONTRACT_ADDRESS
    });
    
    return result.value;
  } catch (error) {
    console.error('Error getting pending revocation:', error);
    return null;
  }
}