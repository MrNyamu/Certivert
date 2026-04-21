/**
 * Blockchain and Stacks-related types
 */

// Stacks network types
export type StacksNetwork = 'mainnet' | 'testnet' | 'devnet' | 'simnet';

// Transaction result types
export interface TransactionResult {
  txId: string;
  success: boolean;
  error?: string;
}

// Blockchain health status
export interface BlockchainHealthStatus {
  connected: boolean;
  info: {
    stacksHeight: number;
    burnHeight: number;
    networkId: number;
    version: string;
    isFullySynced: boolean;
  } | null;
  error: string | null;
}

// Contract deployment status
export interface ContractDeploymentStatus {
  deployed: boolean;
  contracts: {
    roleRegistry: {
      deployed: boolean;
      status: number;
      contractId: string;
    };
    certificateStore: {
      deployed: boolean;
      status: number;
      contractId: string;
    };
  } | null;
  error: string | null;
}

// Contract read access status
export interface ContractReadAccessStatus {
  accessible: boolean;
  tests: {
    roleRegistryRead: {
      success: boolean;
      status: number;
    };
  } | null;
  error: string | null;
}

// Overall blockchain status
export interface BlockchainStatus {
  status: 'healthy' | 'unreachable' | 'contracts-missing' | 'contracts-inaccessible' | 'error';
  details: {
    node: BlockchainHealthStatus;
    contracts: ContractDeploymentStatus;
    readAccess: ContractReadAccessStatus;
  };
}

// Clarity value types (for contract call responses)
export interface ClarityValue {
  type: string;
  data?: any;
  value?: any;
}

export interface ClarityTuple extends ClarityValue {
  type: 'tuple';
  data: Record<string, ClarityValue>;
}

export interface ClarityOptional extends ClarityValue {
  type: 'some' | 'none';
  value?: ClarityValue;
}

export interface ClarityUint extends ClarityValue {
  type: 'uint';
  value: string;
}

export interface ClarityPrincipal extends ClarityValue {
  type: 'principal';
  data: string;
}

export interface ClarityStringAscii extends ClarityValue {
  type: 'string-ascii';
  data: string;
}

export interface ClarityBool extends ClarityValue {
  type: 'true' | 'false';
}

// Contract function call parameters
export interface ContractCallOptions {
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: any[];
  senderKey?: string;
  senderAddress?: string;
  network: any; // Stacks network instance
  anchorMode?: number;
  fee?: number;
}

// Read-only function call options
export interface ReadOnlyFunctionOptions {
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: any[];
  network: any;
  senderAddress: string;
}