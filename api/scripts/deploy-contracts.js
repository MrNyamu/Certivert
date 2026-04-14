#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { config } from '../src/config.js';
import StacksTransactions from '@stacks/transactions';
const { 
  makeContractDeploy, 
  broadcastTransaction, 
  ClarityVersion 
} = StacksTransactions;

import StacksNetwork from '@stacks/network';
const { STACKS_DEVNET } = StacksNetwork;

/**
 * Deploy contracts to devnet manually using @stacks/transactions
 */

async function deployContract(contractName, contractPath, deployerPrivateKey) {
  console.log(`Deploying contract "${contractName}" from ${contractPath}`);
  
  try {
    // Read the contract source code
    const contractSource = fs.readFileSync(contractPath, 'utf8');
    console.log(`Contract source loaded: ${contractSource.length} characters`);
    
    const txOptions = {
      contractName,
      codeBody: contractSource,
      senderKey: deployerPrivateKey,
      network: STACKS_DEVNET,
      anchorMode: 1, // on-chain only
      clarityVersion: ClarityVersion.Clarity4,
      fee: 100000 // higher fee for contract deployment
    };

    console.log(`Creating deployment transaction...`);
    const transaction = await makeContractDeploy(txOptions);
    
    console.log(`Broadcasting transaction...`);
    const broadcastResponse = await broadcastTransaction(transaction, STACKS_DEVNET);
    
    if (broadcastResponse.error) {
      console.error(`Error deploying ${contractName}:`, broadcastResponse.error);
      return { success: false, txid: null, error: broadcastResponse.error };
    }
    
    console.log(`✅ Contract "${contractName}" deployed successfully`);
    console.log(`   Transaction ID: ${broadcastResponse.txid}`);
    console.log(`   Contract ID: ${config.CONTRACT_ADDRESS}.${contractName}`);
    
    return { success: true, txid: broadcastResponse.txid, error: null };
  } catch (error) {
    console.error(`❌ Failed to deploy "${contractName}":`, error.message);
    return { success: false, txid: null, error: error.message };
  }
}

async function waitForTransaction(txid) {
  console.log(`Waiting for transaction ${txid} to be confirmed...`);
  
  const maxAttempts = 30;
  const interval = 2000; // 2 seconds
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`${config.STACKS_API_URL}/extended/v1/tx/${txid}`);
      const txData = await response.json();
      
      if (txData.tx_status === 'success') {
        console.log(`✅ Transaction confirmed in block ${txData.block_height}`);
        return true;
      } else if (txData.tx_status === 'abort_by_response' || txData.tx_status === 'abort_by_post_condition') {
        console.error(`❌ Transaction failed: ${txData.tx_status}`);
        return false;
      }
      
      console.log(`   Attempt ${attempt}/${maxAttempts}: Status is ${txData.tx_status}`);
    } catch (error) {
      console.log(`   Attempt ${attempt}/${maxAttempts}: Checking transaction status...`);
    }
    
    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
  
  console.log(`⚠️  Transaction ${txid} not confirmed after ${maxAttempts} attempts`);
  return false;
}

async function main() {
  console.log('🚀 Deploying Certivert contracts to devnet...\n');
  
  console.log('Configuration:');
  console.log(`  Network: ${config.STACKS_NETWORK}`);
  console.log(`  Stacks API: ${config.STACKS_API_URL}`);
  console.log(`  Contract Address: ${config.CONTRACT_ADDRESS}`);
  console.log(`  Deployer Key: ${config.DEPLOYER_PRIVATE_KEY ? 'PROVIDED' : 'MISSING'}\n`);

  const deployerPrivateKey = config.DEPLOYER_PRIVATE_KEY;
  
  if (!deployerPrivateKey) {
    console.error('❌ DEPLOYER_PRIVATE_KEY is not set in configuration');
    process.exit(1);
  }

  // Deploy role-registry contract first (certificate-store depends on it)
  console.log('1. Deploying role-registry contract...');
  const roleRegistryResult = await deployContract(
    'role-registry',
    path.join(process.cwd(), '../contracts/role-registry.clar'),
    deployerPrivateKey
  );
  
  if (!roleRegistryResult.success) {
    console.error('❌ Failed to deploy role-registry. Aborting.');
    process.exit(1);
  }

  // Wait for role-registry to be confirmed
  const roleRegistryConfirmed = await waitForTransaction(roleRegistryResult.txid);
  if (!roleRegistryConfirmed) {
    console.error('❌ role-registry deployment not confirmed. Aborting.');
    process.exit(1);
  }

  console.log('\n2. Deploying certificate-store contract...');
  const certificateStoreResult = await deployContract(
    'certificate-store', 
    path.join(process.cwd(), '../contracts/certificate-store.clar'),
    deployerPrivateKey
  );
  
  if (!certificateStoreResult.success) {
    console.error('❌ Failed to deploy certificate-store.');
    process.exit(1);
  }

  // Wait for certificate-store to be confirmed
  const certificateStoreConfirmed = await waitForTransaction(certificateStoreResult.txid);
  if (!certificateStoreConfirmed) {
    console.error('❌ certificate-store deployment not confirmed.');
    process.exit(1);
  }

  console.log('\n🎉 All contracts deployed successfully!');
  console.log('\nContract IDs:');
  console.log(`  role-registry: ${config.CONTRACT_ADDRESS}.role-registry`);
  console.log(`  certificate-store: ${config.CONTRACT_ADDRESS}.certificate-store`);
  console.log('\nNext steps:');
  console.log('1. Run role setup: node scripts/setup-roles.js');
  console.log('2. Test the API: curl http://localhost:3002/health');
  console.log('3. Run E2E tests: npm test');
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the deployment
main().catch(error => {
  console.error('❌ Deployment failed:', error);
  process.exit(1);
});