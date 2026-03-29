import { describe, it, expect } from "vitest";
import { hashRecord } from "../../server/hash-agility";

type Block = {
  blockNumber: number;
  timestamp: string;
  algorithm: string;
  transactionData: Record<string, unknown>;
  prevHash: string;
  hash: string;
};

function makeBlock(prev: Block | null, tx: Record<string, unknown>, algorithm = "sha256"): Block {
  const blockNumber = (prev?.blockNumber ?? 0) + 1;
  const prevHash = prev?.hash ?? "0000000000000000";
  const timestamp = new Date(1700000000000 + blockNumber * 1000).toISOString();
  const hash = hashRecord({ blockNumber, timestamp, algorithm, transactionData: tx, prevHash }, algorithm);
  return { blockNumber, timestamp, algorithm, transactionData: tx, prevHash, hash };
}

describe("audit chain", () => {
  it("genesis block has prevHash = '0000000000000000'", () => {
    const genesis = makeBlock(null, { type: "genesis" });
    expect(genesis.prevHash).toBe("0000000000000000");
  });

  it("each block's prevHash matches previous block's hash", () => {
    const b1 = makeBlock(null, { type: "a" });
    const b2 = makeBlock(b1, { type: "b" });
    expect(b2.prevHash).toBe(b1.hash);
  });

  it("block hash is recomputable from block fields", () => {
    const b1 = makeBlock(null, { type: "a" });
    const recomputed = hashRecord({ blockNumber: b1.blockNumber, timestamp: b1.timestamp, algorithm: b1.algorithm, transactionData: b1.transactionData, prevHash: b1.prevHash }, b1.algorithm);
    expect(recomputed).toBe(b1.hash);
  });

  it("block number is sequential with no gaps", () => {
    const b1 = makeBlock(null, { type: "a" });
    const b2 = makeBlock(b1, { type: "b" });
    const b3 = makeBlock(b2, { type: "c" });
    expect([b1.blockNumber, b2.blockNumber, b3.blockNumber]).toEqual([1, 2, 3]);
  });
});
