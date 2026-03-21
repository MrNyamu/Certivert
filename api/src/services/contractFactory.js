import { config } from '../config.js';

/**
 * Factory function to get the appropriate contract service based on network configuration
 * @returns {Object} Contract service with all the required methods
 */
export async function getContractService() {
  console.log(`Creating contract service for network: ${config.STACKS_NETWORK}`);
  
  if (config.STACKS_NETWORK === 'simnet') {
    // Use simnet service for local development
    const simnetService = await import('./simnet.js');
    
    // Initialize simnet on first load
    await simnetService.initializeSimnet();
    
    return {
      proposeCertificate: simnetService.proposeCertificate,
      approveCertificate: simnetService.approveCertificate,
      revokeCertificate: simnetService.revokeCertificate,
      verifyCertificate: simnetService.verifyCertificate,
      getPendingTx: simnetService.getPendingTx,
      getKeyByRole: simnetService.getKeyByRole
    };
  } else {
    // Use network-based service for devnet/testnet/mainnet
    const networkService = await import('./contract.js');
    
    return {
      proposeCertificate: networkService.proposeCertificate,
      approveCertificate: networkService.approveCertificate,
      revokeCertificate: networkService.revokeCertificate,
      verifyCertificate: networkService.verifyCertificate,
      getPendingTx: networkService.getPendingTx,
      getKeyByRole: networkService.getKeyByRole
    };
  }
}

// Cache the service instance to avoid re-initialization
let contractServiceInstance = null;

/**
 * Get cached contract service instance
 */
export async function getCachedContractService() {
  if (!contractServiceInstance) {
    contractServiceInstance = await getContractService();
  }
  return contractServiceInstance;
}