import { config } from '../config.js';
import type { ContractService } from '../types/index.js';

/**
 * Factory function to get the contract service for devnet
 * @returns Contract service with all the required methods
 */
export async function getContractService(): Promise<ContractService> {
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
let contractServiceInstance: ContractService | null = null;

/**
 * Get cached contract service instance
 * @returns Cached contract service instance
 */
export async function getCachedContractService(): Promise<ContractService> {
  if (!contractServiceInstance) {
    contractServiceInstance = await getContractService();
  }
  return contractServiceInstance;
}