import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getHashAlgorithm, isAlgorithmApproved, hashRecord, validateEscrowFinality } from "../../server/hash-agility";

describe("hash agility", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.useFakeTimers();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = originalEnv;
  });

  it("getHashAlgorithm() returns env var value", () => {
    process.env.HASH_ALGORITHM = "sha3-256";
    expect(getHashAlgorithm()).toBe("sha3-256");
  });

  it("getHashAlgorithm() returns 'sha256' when env not set", () => {
    delete process.env.HASH_ALGORITHM;
    expect(getHashAlgorithm()).toBe("sha256");
  });

  it("hashRecord() produces consistent output for same input", () => {
    const payload = { a: 1, b: "test" };
    expect(hashRecord(payload, "sha256")).toBe(hashRecord(payload, "sha256"));
  });

  it("hashRecord() uses current HASH_ALGORITHM", () => {
    process.env.HASH_ALGORITHM = "sha512";
    const payload = { x: 42 };
    const hashUsingDefault = hashRecord(payload);
    const hashSha256 = hashRecord(payload, "sha256");
    expect(hashUsingDefault).not.toBe(hashSha256);
  });

  it("isAlgorithmApproved() returns true for approved algorithms", () => {
    expect(isAlgorithmApproved("sha256")).toBe(true);
  });

  it("isAlgorithmApproved() returns false for unapproved algorithms", () => {
    expect(isAlgorithmApproved("md5")).toBe(false);
  });

  it("validateEscrowFinality() returns settled=true after 24hrs", () => {
    vi.setSystemTime(new Date("2026-03-29T12:00:00.000Z"));
    const settledAt = new Date("2026-03-28T11:59:00.000Z");
    const finality = validateEscrowFinality(settledAt, "sha256", 24);
    expect(finality.settled).toBe(true);
  });

  it("validateEscrowFinality() returns requiresManualReview=true for deprecated algo", () => {
    vi.setSystemTime(new Date("2026-03-29T12:00:00.000Z"));
    const settledAt = new Date("2026-03-28T11:00:00.000Z");
    const finality = validateEscrowFinality(settledAt, "md5", 24);
    expect(finality.settled).toBe(true);
    expect(finality.requiresManualReview).toBe(true);
  });

  it("validateEscrowFinality() never auto-rejects", () => {
    const settledAt = new Date();
    const finality = validateEscrowFinality(settledAt, "md5", 24) as any;
    expect(finality.rejected).toBeUndefined();
  });
});
