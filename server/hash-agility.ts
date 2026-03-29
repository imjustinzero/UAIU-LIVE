import { createHash } from "node:crypto";

const DEFAULT_HASH_ALGORITHM = "sha256";
const DEFAULT_APPROVED_ALGORITHMS = "sha256,sha3-256,blake2b512";

function parseApprovedAlgorithms(value: string | undefined): string[] {
  return (value ?? DEFAULT_APPROVED_ALGORITHMS)
    .split(",")
    .map((alg) => alg.trim().toLowerCase())
    .filter(Boolean);
}

export function getApprovedAlgorithms(): string[] {
  return parseApprovedAlgorithms(process.env.APPROVED_ALGORITHMS);
}

export function isAlgorithmApproved(alg: string): boolean {
  return getApprovedAlgorithms().includes(String(alg || "").trim().toLowerCase());
}

export function getHashAlgorithm(): string {
  return process.env.HASH_ALGORITHM || DEFAULT_HASH_ALGORITHM;
}

export function hashRecord(input: Record<string, unknown>, algorithm = getHashAlgorithm()): string {
  return createHash(algorithm).update(JSON.stringify(input)).digest("hex");
}

export function validateEscrowFinality(
  settledAt: Date,
  algorithmAtSettlement: string,
  finalityHours?: number,
): {
  settled: boolean;
  hoursElapsed: number;
  requiredHours: number;
  algorithmAtSettlement: string;
  algorithmApproved: boolean;
  requiresManualReview: boolean;
  approvedAlgorithms: string[];
  hoursRemaining: number;
  percentComplete: number;
} {
  const requiredHours = finalityHours ?? Number(process.env.ESCROW_FINALITY_HOURS || 24);
  const settledDate = settledAt instanceof Date ? settledAt : new Date(settledAt);
  const hoursElapsed = Math.max(0, (Date.now() - settledDate.getTime()) / (1000 * 60 * 60));
  const settled = hoursElapsed >= requiredHours;
  const algorithmApproved = isAlgorithmApproved(algorithmAtSettlement || "");

  const hoursRemaining = Math.max(0, requiredHours - hoursElapsed);
  const percentComplete = Math.min(100, Math.max(0, Math.round((hoursElapsed / requiredHours) * 100)));
  const approvedAlgorithms = getApprovedAlgorithms();

  return {
    settled,
    hoursElapsed,
    requiredHours,
    algorithmAtSettlement: algorithmAtSettlement || "unknown",
    algorithmApproved,
    requiresManualReview: settled && !algorithmApproved,
    approvedAlgorithms,
    hoursRemaining,
    percentComplete,
  };
}
