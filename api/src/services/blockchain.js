import { config } from '../config.js';

/**
 * Checks if the Stacks blockchain node is accessible and healthy
 * @returns {Promise<{connected: boolean, info: Object|null, error: string|null}>}
 */
export async function checkBlockchainHealth() {
  try {
    console.log(`Checking blockchain health at: ${config.STACKS_API_URL}`);
    
    const response = await fetch(`${config.STACKS_API_URL}/v2/info`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const info = await response.json();
    
    // Validate that we got expected data structure
    if (!info.stacks_tip_height || !info.burn_block_height) {
      throw new Error('Invalid response structure from blockchain node');
    }
    
    console.log(`Blockchain health check successful. Tip height: ${info.stacks_tip_height}`);
    
    return {
      connected: true,
      info: {
        stacksHeight: info.stacks_tip_height,
        burnHeight: info.burn_block_height,
        networkId: info.network_id,
        version: info.server_version,
        isFullySynced: info.is_fully_synced
      },
      error: null
    };
  } catch (error) {
    console.error('Blockchain health check failed:', error.message);
    
    return {
      connected: false,
      info: null,
      error: error.message
    };
  }
}

/**
 * Checks if our contracts are deployed and accessible
 * @returns {Promise<{deployed: boolean, contracts: Object, error: string|null}>}
 */
export async function checkContractDeployment() {
  try {
    console.log(`Checking contract deployment for: ${config.CONTRACT_ADDRESS}`);
    
    // Check if role-registry contract exists
    const roleContractUrl = `${config.STACKS_API_URL}/extended/v1/contract/${config.CONTRACT_ADDRESS}.${config.CONTRACT_NAME_ROLES}`;
    const roleResponse = await fetch(roleContractUrl, {
      signal: AbortSignal.timeout(5000)
    });
    
    // Check if certificate-store contract exists
    const certContractUrl = `${config.STACKS_API_URL}/extended/v1/contract/${config.CONTRACT_ADDRESS}.${config.CONTRACT_NAME_CERTS}`;
    const certResponse = await fetch(certContractUrl, {
      signal: AbortSignal.timeout(5000)
    });
    
    const contracts = {
      roleRegistry: {
        deployed: roleResponse.ok,
        status: roleResponse.status,
        contractId: `${config.CONTRACT_ADDRESS}.${config.CONTRACT_NAME_ROLES}`
      },
      certificateStore: {
        deployed: certResponse.ok,
        status: certResponse.status,
        contractId: `${config.CONTRACT_ADDRESS}.${config.CONTRACT_NAME_CERTS}`
      }
    };
    
    const allDeployed = contracts.roleRegistry.deployed && contracts.certificateStore.deployed;
    
    console.log(`Contract deployment check: ${allDeployed ? 'SUCCESS' : 'PARTIAL/FAILED'}`);
    
    return {
      deployed: allDeployed,
      contracts,
      error: null
    };
  } catch (error) {
    console.error('Contract deployment check failed:', error.message);
    
    return {
      deployed: false,
      contracts: null,
      error: error.message
    };
  }
}

/**
 * Verify that we can make read-only calls to our contracts
 * @returns {Promise<{accessible: boolean, tests: Object, error: string|null}>}
 */
export async function checkContractReadAccess() {
  try {
    console.log('Testing contract read access...');
    
    // Test role-registry contract
    const roleTestUrl = `${config.STACKS_API_URL}/v2/contracts/call-read/${config.CONTRACT_ADDRESS}/${config.CONTRACT_NAME_ROLES}/get-admin`;
    
    const roleTestResponse = await fetch(roleTestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: config.CONTRACT_ADDRESS,
        arguments: []
      }),
      signal: AbortSignal.timeout(5000)
    });
    
    const tests = {
      roleRegistryRead: {
        success: roleTestResponse.ok,
        status: roleTestResponse.status
      }
    };
    
    const allAccessible = tests.roleRegistryRead.success;
    
    console.log(`Contract read access check: ${allAccessible ? 'SUCCESS' : 'FAILED'}`);
    
    return {
      accessible: allAccessible,
      tests,
      error: null
    };
  } catch (error) {
    console.error('Contract read access check failed:', error.message);
    
    return {
      accessible: false,
      tests: null,
      error: error.message
    };
  }
}

/**
 * Comprehensive blockchain status check
 * @returns {Promise<{status: string, details: Object}>}
 */
export async function getBlockchainStatus() {
  try {
    // Run all checks in parallel
    const [healthCheck, contractCheck, accessCheck] = await Promise.all([
      checkBlockchainHealth(),
      checkContractDeployment(),
      checkContractReadAccess()
    ]);
    
    // Determine overall status
    let status = 'healthy';
    if (!healthCheck.connected) {
      status = 'unreachable';
    } else if (!contractCheck.deployed) {
      status = 'contracts-missing';
    } else if (!accessCheck.accessible) {
      status = 'contracts-inaccessible';
    }
    
    return {
      status,
      details: {
        node: healthCheck,
        contracts: contractCheck,
        readAccess: accessCheck
      }
    };
  } catch (error) {
    console.error('Blockchain status check failed:', error);
    
    return {
      status: 'error',
      details: {
        error: error.message
      }
    };
  }
}