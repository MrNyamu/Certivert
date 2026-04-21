#!/usr/bin/env node

import { config } from '../src/config.js';
import StacksTransactions from '@stacks/transactions';
const { makeContractCall, broadcastTransaction, stringAsciiCV, principalCV } = StacksTransactions;

import StacksNetwork from '@stacks/network';
const { STACKS_DEVNET, STACKS_TESTNET, STACKS_MAINNET } = StacksNetwork;

import { input, select, confirm } from '@inquirer/prompts';
import chalk from 'chalk';

/**
 * Interactive CLI Tool for Role Assignment
 * Allows users to assign roles to wallet addresses
 */

const ROLES = {
  student: 'Student - Can view own certificates',
  university: 'University - Can issue and revoke certificates', 
  knqa: 'KNQA - Admin access to all features',
  none: 'No Role - Remove all permissions'
};

const NETWORKS = {
  devnet: STACKS_DEVNET,
  testnet: STACKS_TESTNET,
  mainnet: STACKS_MAINNET
};

async function getNetworkInstance() {
  const networkName = config.STACKS_NETWORK;
  return NETWORKS[networkName] || STACKS_DEVNET;
}

async function validateAddress(address) {
  // Basic Stacks address validation
  if (!address || typeof address !== 'string') {
    return false;
  }
  
  // Check format: starts with S, followed by T or P, then 38-39 characters  
  const addressRegex = /^S[TP][0-9A-Z]{38,39}$/;
  return addressRegex.test(address.toUpperCase());
}

async function assignRole(userAddress, role, deployerPrivateKey, network) {
  console.log(chalk.blue(`\n🔄 Assigning role "${role}" to ${userAddress}...`));
  
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
      network: network,
      anchorMode: 1, // on-chain
    };

    const transaction = await makeContractCall(txOptions);
    console.log(chalk.yellow('📡 Broadcasting transaction...'));
    
    const broadcastResponse = await broadcastTransaction(transaction, network);
    
    if (broadcastResponse.error) {
      throw new Error(broadcastResponse.error);
    }
    
    console.log(chalk.green(`✅ Role "${role}" assigned successfully!`));
    console.log(chalk.cyan(`   Transaction ID: ${broadcastResponse.txid}`));
    console.log(chalk.gray(`   Explorer: ${getExplorerUrl(broadcastResponse.txid, config.STACKS_NETWORK)}`));
    
    return {
      success: true,
      txid: broadcastResponse.txid,
      role,
      address: userAddress
    };
    
  } catch (error) {
    console.log(chalk.red(`❌ Failed to assign role "${role}": ${error.message}`));
    return {
      success: false,
      error: error.message,
      role,
      address: userAddress
    };
  }
}

function getExplorerUrl(txid, network) {
  switch (network) {
    case 'mainnet':
      return `https://explorer.stacks.co/txid/${txid}`;
    case 'testnet':
      return `https://explorer.stacks.co/txid/${txid}?chain=testnet`;
    default:
      return `http://localhost:8000/txid/${txid}`;
  }
}

async function showCurrentConfig() {
  console.log(chalk.blue('\n📋 Current Configuration:'));
  console.log(`   Network: ${chalk.yellow(config.STACKS_NETWORK)}`);
  console.log(`   Contract Address: ${chalk.yellow(config.CONTRACT_ADDRESS)}`);
  console.log(`   Role Registry: ${chalk.yellow(config.CONTRACT_NAME_ROLES)}`);
  console.log(`   Certificate Store: ${chalk.yellow(config.CONTRACT_NAME_CERTS)}`);
  
  console.log(chalk.blue('\n🏷️  Pre-configured Addresses:'));
  console.log(`   University: ${chalk.green(config.UNIVERSITY_ADDRESS)}`);
  console.log(`   KNQA: ${chalk.purple(config.KNQA_ADDRESS)}`);
  console.log(`   Student: ${chalk.cyan(config.STUDENT_ADDRESS)}`);
}

async function interactiveMode() {
  console.log(chalk.bold.blue('\n🛠️  Certivert Role Assignment CLI\n'));
  
  await showCurrentConfig();

  // Get wallet address
  const address = await input({
    message: 'Enter wallet address to assign role:',
    validate: async (input) => {
      if (!input.trim()) {
        return 'Address is required';
      }
      if (!(await validateAddress(input.trim()))) {
        return 'Invalid Stacks address format (should start with ST or SP)';
      }
      return true;
    }
  });

  const cleanAddress = address.trim().toUpperCase();

  // Select role
  const role = await select({
    message: 'Select role to assign:',
    choices: Object.entries(ROLES).map(([value, description]) => ({
      name: description,
      value,
      description: value === 'knqa' ? chalk.red('⚠️  Admin permissions') : ''
    }))
  });

  // Confirmation
  console.log(chalk.yellow(`\n📝 Assignment Summary:`));
  console.log(`   Address: ${chalk.cyan(cleanAddress)}`);
  console.log(`   Role: ${chalk.green(role)}`);
  console.log(`   Network: ${chalk.blue(config.STACKS_NETWORK)}`);

  const confirmed = await confirm({
    message: 'Proceed with role assignment?',
    default: false
  });

  if (!confirmed) {
    console.log(chalk.yellow('❌ Assignment cancelled.'));
    return;
  }

  // Execute assignment
  const network = await getNetworkInstance();
  const result = await assignRole(
    cleanAddress, 
    role, 
    config.DEPLOYER_PRIVATE_KEY, 
    network
  );

  if (result.success) {
    console.log(chalk.green('\n🎉 Role assignment completed successfully!'));
    
    // Ask if they want to assign another role
    const assignAnother = await confirm({
      message: 'Would you like to assign another role?',
      default: true
    });

    if (assignAnother) {
      await interactiveMode();
    }
  } else {
    console.log(chalk.red('\n💥 Role assignment failed. Check the error above.'));
    
    // Ask if they want to try again
    const tryAgain = await confirm({
      message: 'Would you like to try again?',
      default: true
    });

    if (tryAgain) {
      await interactiveMode();
    }
  }
}

async function batchMode(addresses, role) {
  console.log(chalk.bold.blue('\n📦 Batch Role Assignment\n'));
  
  const network = await getNetworkInstance();
  const results = [];

  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i].trim().toUpperCase();
    console.log(chalk.blue(`\n[${i + 1}/${addresses.length}] Processing ${address}...`));
    
    if (!(await validateAddress(address))) {
      console.log(chalk.red(`❌ Invalid address format: ${address}`));
      results.push({
        success: false,
        error: 'Invalid address format',
        address
      });
      continue;
    }

    const result = await assignRole(address, role, config.DEPLOYER_PRIVATE_KEY, network);
    results.push(result);

    // Wait between transactions to avoid rate limiting
    if (i < addresses.length - 1) {
      console.log(chalk.gray('⏳ Waiting 2 seconds before next transaction...'));
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Summary
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(chalk.bold.green(`\n📊 Batch Assignment Summary:`));
  console.log(`   Total: ${results.length}`);
  console.log(`   Successful: ${chalk.green(successful.length)}`);
  console.log(`   Failed: ${chalk.red(failed.length)}`);

  if (failed.length > 0) {
    console.log(chalk.red('\n❌ Failed Assignments:'));
    failed.forEach(result => {
      console.log(`   ${result.address}: ${result.error}`);
    });
  }
}

async function main() {
  try {
    const args = process.argv.slice(2);

    // Check for help flag
    if (args.includes('--help') || args.includes('-h')) {
      console.log(chalk.bold.blue('Certivert Role Assignment CLI\n'));
      console.log('Usage:');
      console.log('  node assign-role-cli.js                    # Interactive mode');
      console.log('  node assign-role-cli.js <address> <role>   # Single assignment');
      console.log('  node assign-role-cli.js --batch <role> <addr1> <addr2> ...  # Batch assignment');
      console.log('\nRoles: student, university, knqa, none');
      console.log('\nExamples:');
      console.log('  node assign-role-cli.js ST123... university');
      console.log('  node assign-role-cli.js --batch student ST123... ST456...');
      return;
    }

    // Batch mode
    if (args[0] === '--batch') {
      if (args.length < 3) {
        console.log(chalk.red('❌ Batch mode requires: --batch <role> <address1> [address2] ...'));
        return;
      }
      
      const role = args[1];
      const addresses = args.slice(2);
      
      if (!Object.keys(ROLES).includes(role)) {
        console.log(chalk.red(`❌ Invalid role: ${role}. Valid roles: ${Object.keys(ROLES).join(', ')}`));
        return;
      }

      await batchMode(addresses, role);
      return;
    }

    // Single assignment mode
    if (args.length === 2) {
      const [address, role] = args;
      
      if (!(await validateAddress(address))) {
        console.log(chalk.red('❌ Invalid address format'));
        return;
      }

      if (!Object.keys(ROLES).includes(role)) {
        console.log(chalk.red(`❌ Invalid role: ${role}. Valid roles: ${Object.keys(ROLES).join(', ')}`));
        return;
      }

      const network = await getNetworkInstance();
      await assignRole(address.toUpperCase(), role, config.DEPLOYER_PRIVATE_KEY, network);
      return;
    }

    // Interactive mode (default)
    await interactiveMode();

  } catch (error) {
    console.log(chalk.red(`\n💥 CLI Error: ${error.message}`));
    process.exit(1);
  }
}

// Handle interrupts
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n👋 Goodbye!'));
  process.exit(0);
});

// Run the CLI
main().catch(error => {
  console.error(chalk.red('💥 Fatal error:', error));
  process.exit(1);
});