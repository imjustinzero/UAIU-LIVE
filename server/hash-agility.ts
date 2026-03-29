const DEFAULT_HASH_ALGORITHM = "sha256";
const DEFAULT_APPROVED_ALGORITHMS = "sha256,sha3-256,blake2b512";

function parseApprovedAlgorithms(value: string | undefined): string[] {
  return (value ?? DEFAULT_APPROVED_ALGORITHMS)
    .split(",")
    .map((alg) => alg.trim().toLowerCase())
    .filter(Boolean);
}

export const APPROVED_ALGORITHMS = parseApprovedAlgorithms(process.env.APPROVED_ALGORITHMS);

export function isAlgorithmApproved(alg: string): boolean {
  return APPROVED_ALGORITHMS.includes(String(alg || "").trim().toLowerCase());
}

export function getHashAlgorithm(): string {
  return process.env.HASH_ALGORITHM || DEFAULT_HASH_ALGORITHM;
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
} {
  const requiredHours = finalityHours ?? Number(process.env.ESCROW_FINALITY_HOURS || 24);
  const settledDate = settledAt instanceof Date ? settledAt : new Date(settledAt);
  const hoursElapsed = Math.max(0, (Date.now() - settledDate.getTime()) / (1000 * 60 * 60));
  const settled = hoursElapsed >= requiredHours;
  const algorithmApproved = isAlgorithmApproved(algorithmAtSettlement || "");

  return {
    settled,
    hoursElapsed,
    requiredHours,
    algorithmAtSettlement: algorithmAtSettlement || "unknown",
    algorithmApproved,
    requiresManualReview: settled && !algorithmApproved,
    approvedAlgorithms: APPROVED_ALGORITHMS,
  };
}
