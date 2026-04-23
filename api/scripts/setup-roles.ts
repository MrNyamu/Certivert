#!/usr/bin/env node

import { config } from '../src/config.js';
import { makeContractCall, broadcastTransaction, uintCV, principalCV, stringAsciiCV } from '@stacks/transactions';
import { StacksDevnet } from '@stacks/network';

/**
 * Setup script to assign roles to devnet wallets
 * Run once after fresh devnet start: node scripts/setup-roles.js
 */

async function assignRole(userAddress, role, deployerPrivateKey) {
  console.log(`Assigning role "${role}" to ${userAddress}`);
  
  try {
    const txOptions = {
      contractAddress: config.CONTRACT_ADDRESS,
      contractName: config.CONTRACT_NAME_ROLES,
      functionName: 'assign-role',
      functionArgs: [
        principalCV(userAddress),
        stringAsciiCV(role)
      ],
      senderKey: deployerPrivateKey,
      network: STACKS_DEVNET,
      anchorMode: 1, // on-chain
    };

    const transaction = await makeContractCall(txOptions);
    const broadcastResponse = await broadcastTransaction(transaction, STACKS_DEVNET);
    
    if (broadcastResponse.error) {
      console.error(`Error assigning role ${role}:`, broadcastResponse.error);
      return false;
    }
    
    console.log(`✅ Role "${role}" assigned to ${userAddress}`);
    console.log(`   Transaction ID: ${broadcastResponse.txid}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to assign role "${role}" to ${userAddress}:`, error.message);
    return false;
  }
}

async function addAuthorizedSigner(signerAddress, deployerPrivateKey) {
  console.log(`Adding authorized signer: ${signerAddress}`);
  
  try {
    const txOptions = {
      contractAddress: config.CONTRACT_ADDRESS,
      contractName: config.CONTRACT_NAME_CERTS,
      functionName: 'add-authorised-signer',
      functionArgs: [
        principalCV(signerAddress)
      ],
      senderKey: deployerPrivateKey,
      network: STACKS_DEVNET,
      anchorMode: 1, // on-chain
    };

    const transaction = await makeContractCall(txOptions);
    const broadcastResponse = await broadcastTransaction(transaction, STACKS_DEVNET);
    
    if (broadcastResponse.error) {
      console.error(`Error adding authorized signer:`, broadcastResponse.error);
      return false;
    }
    
    console.log(`✅ Authorized signer added: ${signerAddress}`);
    console.log(`   Transaction ID: ${broadcastResponse.txid}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to add authorized signer ${signerAddress}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Setting up roles on devnet...\n');
  
  console.log('Configuration:');
  console.log(`  Network: ${config.STACKS_NETWORK}`);
  console.log(`  Contract Address: ${config.CONTRACT_ADDRESS}`);
  console.log(`  University: ${config.UNIVERSITY_ADDRESS}`);
  console.log(`  KNQA: ${config.KNQA_ADDRESS}`);
  console.log(`  Student: ${config.STUDENT_ADDRESS}\n`);

  const deployerPrivateKey = config.DEPLOYER_PRIVATE_KEY;
  const signer2PrivateKey = config.SIGNER_2_PRIVATE_KEY;

  // Wait a bit for devnet to be ready
  console.log('Waiting 5 seconds for devnet to be ready...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  let success = true;

  // Assign roles
  success &= await assignRole(config.UNIVERSITY_ADDRESS, 'university', deployerPrivateKey);
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait between transactions

  success &= await assignRole(config.KNQA_ADDRESS, 'knqa', deployerPrivateKey);  
  await new Promise(resolve => setTimeout(resolve, 1000));

  success &= await assignRole(config.STUDENT_ADDRESS, 'student', deployerPrivateKey);
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Add authorized signer
  // Note: We derive the signer2 address from the private key
  // For simplicity, using one of the configured addresses as signer2
  success &= await addAuthorizedSigner(config.KNQA_ADDRESS, deployerPrivateKey);

  if (success) {
    console.log('\n🎉 All roles set up successfully!');
    console.log('\nYou can now run E2E tests:');
    console.log('  cd api && npm test');
  } else {
    console.log('\n❌ Some role assignments failed. Check the logs above.');
    process.exit(1);
  }
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

// Run the setup
main().catch(error => {
  console.error('❌ Setup failed:', error);
  process.exit(1);
});