import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Environment configuration
export const config = {
  // Stacks configuration
  // Options: 'simnet' (local in-process), 'devnet' (local docker), 'testnet', 'mainnet'
  STACKS_NETWORK: process.env.STACKS_NETWORK || 'devnet',
  STACKS_API_URL: process.env.STACKS_API_URL || 'http://localhost:3999',
  CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS || 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
  CONTRACT_NAME_ROLES: process.env.CONTRACT_NAME_ROLES || 'role-registry',
  CONTRACT_NAME_CERTS: process.env.CONTRACT_NAME_CERTS || 'certificate-store',
  
  // IPFS configuration
  IPFS_API_URL: process.env.IPFS_API_URL || 'http://127.0.0.1:5001',
  
  // API configuration
  API_PORT: process.env.API_PORT || 3001,
  
  // Encryption configuration
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
  
  // Private keys (devnet keys for prototype)
  DEPLOYER_PRIVATE_KEY: process.env.DEPLOYER_PRIVATE_KEY || '753b7cc01a1a2e86221266a154af739463fce51219d97e4f856cd7200c3d7ac5',
  SIGNER_2_PRIVATE_KEY: process.env.SIGNER_2_PRIVATE_KEY || '7287ba251d44a4d3fd9276c88ce34c5c52a038955511cccaf77e61efef9f6c27'
};

// Validate required environment variables
const requiredVars = ['ENCRYPTION_KEY'];
for (const varName of requiredVars) {
  if (!process.env[varName] && !config[varName]) {
    console.warn(`Warning: ${varName} is not set. Using default value.`);
  }
}

console.log('Configuration loaded:');
console.log(`- Network: ${config.STACKS_NETWORK}`);
console.log(`- Stacks API: ${config.STACKS_API_URL}`);
console.log(`- Contract Address: ${config.CONTRACT_ADDRESS}`);
console.log(`- IPFS API: ${config.IPFS_API_URL}`);
console.log(`- Port: ${config.API_PORT}`);