import { config } from '../config.js';

/**
 * Factory function to get the contract service for devnet
 * @returns {Object} Contract service with all the required methods
 */
export async function getContractService() {
  console.log(`Creating contract service for network: ${config.STACKS_NETWORK}`);
  
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