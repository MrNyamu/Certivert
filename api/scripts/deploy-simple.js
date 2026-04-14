#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { config } from '../src/config.js';

/**
 * Simple contract deployment using curl and the Stacks API directly
 */

async function deployContractViaAPI(contractName, contractSource, privateKey) {
  console.log(`Deploying ${contractName}...`);
  
  // Create the transaction payload for contract deployment
  const payload = {
    contract_name: contractName,
    source_code: contractSource,
    sender_key: privateKey,
    fee_rate: 100000,
    nonce_mode: "auto"
  };
  
  try {
    const response = await fetch(`${config.STACKS_API_URL}/v2/contracts/call-contract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.text();
    console.log(`Response: ${result}`);
    
    if (response.ok) {
      console.log(`✅ ${contractName} deployment initiated`);
      return { success: true, response: result };
    } else {
      console.error(`❌ Failed to deploy ${contractName}: ${result}`);
      return { success: false, error: result };
    }
  } catch (error) {
    console.error(`❌ Error deploying ${contractName}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🚀 Deploying contracts via Stacks API...\n');
  
  console.log('Configuration:');
  console.log(`  Stacks API: ${config.STACKS_API_URL}`);
  console.log(`  Contract Address: ${config.CONTRACT_ADDRESS}`);
  console.log(`  Deployer Key: ${config.DEPLOYER_PRIVATE_KEY ? 'PROVIDED' : 'MISSING'}\n`);

  // Read contract sources
  const roleRegistrySource = fs.readFileSync('../contracts/role-registry.clar', 'utf8');
  const certificateStoreSource = fs.readFileSync('../contracts/certificate-store.clar', 'utf8');
  
  console.log(`Role registry source: ${roleRegistrySource.length} characters`);
  console.log(`Certificate store source: ${certificateStoreSource.length} characters`);
  
  // Deploy role-registry first
  console.log('\n1. Deploying role-registry...');
  const roleResult = await deployContractViaAPI(
    'role-registry',
    roleRegistrySource,
    config.DEPLOYER_PRIVATE_KEY
  );
  
  if (!roleResult.success) {
    console.error('❌ Failed to deploy role-registry');
    process.exit(1);
  }
  
  // Wait a bit before deploying the second contract
  console.log('Waiting 5 seconds...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Deploy certificate-store
  console.log('\n2. Deploying certificate-store...');
  const certResult = await deployContractViaAPI(
    'certificate-store',
    certificateStoreSource,
    config.DEPLOYER_PRIVATE_KEY
  );
  
  if (!certResult.success) {
    console.error('❌ Failed to deploy certificate-store');
    process.exit(1);
  }
  
  console.log('\n🎉 Contract deployment requests sent!');
  console.log('Wait a few minutes for the contracts to be mined, then check:');
  console.log('  curl http://localhost:3002/health');
}

main().catch(error => {
  console.error('❌ Deployment failed:', error);
  process.exit(1);
});