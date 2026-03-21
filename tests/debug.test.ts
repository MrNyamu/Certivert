// Debug test to see account structure
import { describe, expect, it } from "vitest";

declare const simnet: any;

describe("debug", () => {
  it("should show account structure", () => {
    const accounts = simnet.getAccounts();
    const deployer = accounts.get("deployer");
    const wallet1 = accounts.get("wallet_1");
    
    // Check if accounts exist and have expected properties
    expect(deployer).toBeDefined();
    expect(wallet1).toBeDefined();
    
    // Let's check common property names
    console.log("Deployer properties:", Object.keys(deployer || {}));
    console.log("Deployer.address:", deployer?.address);
    console.log("Deployer.stxAddress:", deployer?.stxAddress);  
    console.log("Deployer.principal:", deployer?.principal);
    
    if (deployer) {
      const deployerProps = Object.keys(deployer);
      for (const prop of deployerProps) {
        if (prop.includes('address') || prop.includes('Address')) {
          console.log(`Found address property: ${prop} = ${deployer[prop]}`);
        }
      }
    }
  });
});