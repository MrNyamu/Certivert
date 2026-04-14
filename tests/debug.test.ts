// Debug test to see account structure
import { describe, expect, it } from "vitest";

declare const simnet: any;

describe("debug", () => {
  it("should show account structure", () => {
    const accounts = simnet.getAccounts();
    
    // Print all available account keys
    console.log("All account keys:", [...accounts.keys()]);
    
    // Try different account keys
    const deployer = accounts.get("deployer");
    const wallet1 = accounts.get("wallet_1");
    const wallet2 = accounts.get("wallet_2");
    const wallet3 = accounts.get("wallet_3");
    const wallet4 = accounts.get("wallet_4");
    
    console.log("Deployer exists:", !!deployer);
    console.log("Wallet 1 exists:", !!wallet1);
    console.log("Wallet 2 exists:", !!wallet2);
    console.log("Wallet 3 exists:", !!wallet3);
    console.log("Wallet 4 exists:", !!wallet4);
    
    if (deployer) {
      console.log("Deployer properties:", Object.keys(deployer));
      console.log("Deployer value at index 0:", deployer[0]);
      console.log("Deployer address:", deployer.address || deployer.stxAddress || deployer.principal);
      // Try to access address via string method
      if (typeof deployer === 'string') {
        console.log("Deployer is string:", deployer);
      } else if (deployer.toString) {
        console.log("Deployer toString():", deployer.toString());
      }
    }
    
    if (wallet1) {
      console.log("Wallet 1 value:", wallet1);
      console.log("Wallet 1 toString():", wallet1.toString ? wallet1.toString() : 'no toString');
      console.log("Wallet 1 address:", wallet1.address || wallet1.stxAddress || wallet1.principal);
    }
    
    // Just to make test pass
    expect(accounts).toBeDefined();
  });
});