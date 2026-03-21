import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

declare const simnet: any;

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!

describe("role-registry contract", () => {
  beforeEach(() => {
    // Reset between tests is handled by vitest-environment-clarinet
  });

  describe("admin functions", () => {
    it("should allow admin to assign a valid role", () => {
      const { result } = simnet.callPublicFn(
        "role-registry",
        "assign-role",
        [Cl.principal(wallet1), Cl.stringAscii("university")],
        deployer
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should not allow non-admin to assign a role", () => {
      const { result } = simnet.callPublicFn(
        "role-registry",
        "assign-role",
        [Cl.principal(wallet2), Cl.stringAscii("university")],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(401)); // ERR-NOT-ADMIN
    });

    it("should reject invalid role strings", () => {
      const { result } = simnet.callPublicFn(
        "role-registry",
        "assign-role",
        [Cl.principal(wallet1), Cl.stringAscii("invalid-role")],
        deployer
      );

      expect(result).toBeErr(Cl.uint(400)); // ERR-INVALID-ROLE
    });

    it("should allow admin to revoke a role", () => {
      // First assign a role
      const { result: assignResult } = simnet.callPublicFn(
        "role-registry",
        "assign-role",
        [Cl.principal(wallet1), Cl.stringAscii("student")],
        deployer
      );
      expect(assignResult).toBeOk(Cl.bool(true));

      // Then revoke it
      const { result: revokeResult } = simnet.callPublicFn(
        "role-registry",
        "revoke-role",
        [Cl.principal(wallet1)],
        deployer
      );

      expect(revokeResult).toBeOk(Cl.bool(true));
    });

    it("should not allow revoking non-existent role", () => {
      const { result } = simnet.callPublicFn(
        "role-registry",
        "revoke-role",
        [Cl.principal(wallet1)],
        deployer
      );

      expect(result).toBeErr(Cl.uint(404)); // ERR-ROLE-NOT-FOUND
    });
  });

  describe("read-only functions", () => {
    beforeEach(() => {
      // Assign roles for testing
      simnet.callPublicFn(
        "role-registry",
        "assign-role",
        [Cl.principal(wallet1), Cl.stringAscii("university")],
        deployer
      );
      simnet.callPublicFn(
        "role-registry",
        "assign-role",
        [Cl.principal(wallet2), Cl.stringAscii("knqa")],
        deployer
      );
    });

    it("should return correct role for user", () => {
      const { result } = simnet.callReadOnlyFn(
        "role-registry",
        "get-role",
        [Cl.principal(wallet1)],
        deployer
      );

      expect(result).toBeSome(Cl.stringAscii("university"));
    });

    it("should return none for user without role", () => {
      const { result } = simnet.callReadOnlyFn(
        "role-registry",
        "get-role",
        [Cl.principal("ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP")],
        deployer
      );

      expect(result).toBeNone();
    });

    it("should correctly check if user has specific role", () => {
      const { result } = simnet.callReadOnlyFn(
        "role-registry",
        "has-role",
        [Cl.principal(wallet1), Cl.stringAscii("university")],
        deployer
      );

      expect(result).toBeBool(true);

      const { result: result2 } = simnet.callReadOnlyFn(
        "role-registry",
        "has-role",
        [Cl.principal(wallet1), Cl.stringAscii("student")],
        deployer
      );

      expect(result2).toBeBool(false);
    });

    it("should correctly identify university users", () => {
      const { result } = simnet.callReadOnlyFn(
        "role-registry",
        "is-university",
        [Cl.principal(wallet1)],
        deployer
      );

      expect(result).toBeBool(true);

      const { result: result2 } = simnet.callReadOnlyFn(
        "role-registry",
        "is-university",
        [Cl.principal(wallet2)],
        deployer
      );

      expect(result2).toBeBool(false);
    });

    it("should correctly identify KNQA users", () => {
      const { result } = simnet.callReadOnlyFn(
        "role-registry",
        "is-knqa",
        [Cl.principal(wallet2)],
        deployer
      );

      expect(result).toBeBool(true);

      const { result: result2 } = simnet.callReadOnlyFn(
        "role-registry",
        "is-knqa",
        [Cl.principal(wallet1)],
        deployer
      );

      expect(result2).toBeBool(false);
    });
  });
});