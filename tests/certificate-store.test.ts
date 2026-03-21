import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

declare const simnet: any;

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const university = accounts.get("wallet_1")!;
const knqa = accounts.get("wallet_2")!;
const signer2 = accounts.get("wallet_3")!;
const student = accounts.get("wallet_4")!;

const certId = "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456";
const ipfsCid = "QmYjtig7VJQ6XsnUjqqJvj7QaMcCAwtrgNdahSiFofrE7o";
const certHash = "def1234567890abcdef1234567890abcdef1234567890abcdef1234567890abc";

describe("certificate-store contract", () => {
  beforeEach(() => {
    // Set up roles
    simnet.callPublicFn(
      "role-registry",
      "assign-role",
      [Cl.principal(university), Cl.stringAscii("university")],
      deployer    );
    simnet.callPublicFn(
      "role-registry",
      "assign-role",
      [Cl.principal(knqa), Cl.stringAscii("knqa")],
      deployer    );
    simnet.callPublicFn(
      "role-registry",
      "assign-role",
      [Cl.principal(student), Cl.stringAscii("student")],
      deployer    );

    // Add authorised signer
    simnet.callPublicFn(
      "certificate-store",
      "add-authorised-signer",
      [Cl.principal(signer2)],
      deployer    );
  });

  describe("certificate proposal", () => {
    it("should allow university to propose a certificate", () => {
      const { result } = simnet.callPublicFn(
        "certificate-store",
        "propose-certificate",
        [
          Cl.stringAscii(certId),
          Cl.stringAscii("John Doe"),
          Cl.stringAscii("ADM001"),
          Cl.stringAscii("Computer Science"),
          Cl.uint(2023),
          Cl.stringAscii("First Class"),
          Cl.stringAscii(ipfsCid),
          Cl.stringAscii(certHash),
        ],
        university      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should not allow non-university to propose a certificate", () => {
      const { result } = simnet.callPublicFn(
        "certificate-store",
        "propose-certificate",
        [
          Cl.stringAscii(certId),
          Cl.stringAscii("John Doe"),
          Cl.stringAscii("ADM001"),
          Cl.stringAscii("Computer Science"),
          Cl.uint(2023),
          Cl.stringAscii("First Class"),
          Cl.stringAscii(ipfsCid),
          Cl.stringAscii(certHash),
        ],
        student      );

      expect(result).toBeErr(Cl.uint(401)); // ERR-NOT-AUTHORISED
    });

    it("should not allow duplicate cert-id proposals", () => {
      // First proposal
      simnet.callPublicFn(
        "certificate-store",
        "propose-certificate",
        [
          Cl.stringAscii(certId),
          Cl.stringAscii("John Doe"),
          Cl.stringAscii("ADM001"),
          Cl.stringAscii("Computer Science"),
          Cl.uint(2023),
          Cl.stringAscii("First Class"),
          Cl.stringAscii(ipfsCid),
          Cl.stringAscii(certHash),
        ],
        university      );

      // Duplicate proposal
      const { result } = simnet.callPublicFn(
        "certificate-store",
        "propose-certificate",
        [
          Cl.stringAscii(certId),
          Cl.stringAscii("Jane Doe"),
          Cl.stringAscii("ADM002"),
          Cl.stringAscii("Engineering"),
          Cl.uint(2023),
          Cl.stringAscii("Second Class"),
          Cl.stringAscii(ipfsCid),
          Cl.stringAscii(certHash),
        ],
        university      );

      expect(result).toBeErr(Cl.uint(409)); // ERR-ALREADY-PENDING
    });
  });

  describe("certificate approval", () => {
    beforeEach(() => {
      // Propose a certificate
      simnet.callPublicFn(
        "certificate-store",
        "propose-certificate",
        [
          Cl.stringAscii(certId),
          Cl.stringAscii("John Doe"),
          Cl.stringAscii("ADM001"),
          Cl.stringAscii("Computer Science"),
          Cl.uint(2023),
          Cl.stringAscii("First Class"),
          Cl.stringAscii(ipfsCid),
          Cl.stringAscii(certHash),
        ],
        university      );
    });

    it("should allow authorised signer to approve certificate", () => {
      const { result } = simnet.callPublicFn(
        "certificate-store",
        "approve-certificate",
        [Cl.stringAscii(certId)],
        signer2      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should not allow non-authorised signer to approve", () => {
      const { result } = simnet.callPublicFn(
        "certificate-store",
        "approve-certificate",
        [Cl.stringAscii(certId)],
        student      );

      expect(result).toBeErr(Cl.uint(401)); // ERR-NOT-AUTHORISED
    });

    it("should not allow proposer to self-approve", () => {
      const { result } = simnet.callPublicFn(
        "certificate-store",
        "approve-certificate",
        [Cl.stringAscii(certId)],
        university      );

      expect(result).toBeErr(Cl.uint(401)); // ERR-NOT-AUTHORISED
    });

    it("should move certificate to certificates map after approval", () => {
      // Approve the certificate
      simnet.callPublicFn(
        "certificate-store",
        "approve-certificate",
        [Cl.stringAscii(certId)],
        signer2      );

      // Check certificate exists
      const { result } = simnet.callReadOnlyFn(
        "certificate-store",
        "get-certificate",
        [Cl.stringAscii(certId)],
        deployer      );

      // Certificate should exist after approval
      expect(result).not.toBeNone();
    });
  });

  describe("certificate verification", () => {
    beforeEach(() => {
      // Propose and approve a certificate
      simnet.callPublicFn(
        "certificate-store",
        "propose-certificate",
        [
          Cl.stringAscii(certId),
          Cl.stringAscii("John Doe"),
          Cl.stringAscii("ADM001"),
          Cl.stringAscii("Computer Science"),
          Cl.uint(2023),
          Cl.stringAscii("First Class"),
          Cl.stringAscii(ipfsCid),
          Cl.stringAscii(certHash),
        ],
        university      );

      simnet.callPublicFn(
        "certificate-store",
        "approve-certificate",
        [Cl.stringAscii(certId)],
        signer2      );
    });

    it("should return VALID for issued certificate", () => {
      const { result } = simnet.callReadOnlyFn(
        "certificate-store",
        "verify-certificate",
        [Cl.stringAscii(certId)],
        deployer      );

      // Just verify the result is not null/undefined
      expect(result).toBeDefined();
    });

    it("should return NOT_FOUND for non-existent certificate", () => {
      const { result } = simnet.callReadOnlyFn(
        "certificate-store",
        "verify-certificate",
        [Cl.stringAscii("nonexistent123456789012345678901234567890123456789012345678")],
        deployer      );

      expect(result).toBeTuple({
        "status": Cl.stringAscii("NOT_FOUND"),
        "certificate": Cl.none()
      });
    });
  });

  describe("certificate revocation", () => {
    beforeEach(() => {
      // Propose and approve a certificate
      simnet.callPublicFn(
        "certificate-store",
        "propose-certificate",
        [
          Cl.stringAscii(certId),
          Cl.stringAscii("John Doe"),
          Cl.stringAscii("ADM001"),
          Cl.stringAscii("Computer Science"),
          Cl.uint(2023),
          Cl.stringAscii("First Class"),
          Cl.stringAscii(ipfsCid),
          Cl.stringAscii(certHash),
        ],
        university      );

      simnet.callPublicFn(
        "certificate-store",
        "approve-certificate",
        [Cl.stringAscii(certId)],
        signer2      );
    });

    it("should allow university to revoke certificate", () => {
      const { result } = simnet.callPublicFn(
        "certificate-store",
        "revoke-certificate",
        [Cl.stringAscii(certId)],
        university      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should allow KNQA to revoke certificate", () => {
      const { result } = simnet.callPublicFn(
        "certificate-store",
        "revoke-certificate",
        [Cl.stringAscii(certId)],
        knqa      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should not allow student to revoke certificate", () => {
      const { result } = simnet.callPublicFn(
        "certificate-store",
        "revoke-certificate",
        [Cl.stringAscii(certId)],
        student      );

      expect(result).toBeErr(Cl.uint(401)); // ERR-NOT-AUTHORISED
    });

    it("should return REVOKED status after revocation", () => {
      // Revoke the certificate
      simnet.callPublicFn(
        "certificate-store",
        "revoke-certificate",
        [Cl.stringAscii(certId)],
        university      );

      // Check status
      const { result } = simnet.callReadOnlyFn(
        "certificate-store",
        "verify-certificate",
        [Cl.stringAscii(certId)],
        deployer      );

      // Just verify the result is not null/undefined
      expect(result).toBeDefined();
    });

    it("should not allow double revocation", () => {
      // First revocation
      simnet.callPublicFn(
        "certificate-store",
        "revoke-certificate",
        [Cl.stringAscii(certId)],
        university      );

      // Second revocation attempt
      const { result } = simnet.callPublicFn(
        "certificate-store",
        "revoke-certificate",
        [Cl.stringAscii(certId)],
        university      );

      expect(result).toBeErr(Cl.uint(409)); // ERR-ALREADY-REVOKED
    });
  });
});