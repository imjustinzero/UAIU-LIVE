import { describe, it, expect, vi } from "vitest";
import { validateEscrowFinality } from "../../server/hash-agility";

function getEscrowProgress(settledAt: Date, finalityHours = 24) {
  const finality = validateEscrowFinality(settledAt, "sha256", finalityHours);
  const hoursRemaining = Math.max(0, Math.floor(finality.requiredHours - finality.hoursElapsed));
  const percentComplete = Math.max(0, Math.min(100, Number(((finality.hoursElapsed / finality.requiredHours) * 100).toFixed(2))));
  const finalityEta = new Date(settledAt.getTime() + (finality.requiredHours * 60 * 60 * 1000)).toISOString();
  return { ...finality, hoursRemaining, percentComplete, finalityEta };
}

describe("escrow finality", () => {
  it("T+1 finality calculation is accurate to the minute", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-29T12:00:00.000Z"));
    const settledAt = new Date("2026-03-28T12:01:00.000Z");
    const result = getEscrowProgress(settledAt);
    expect(result.settled).toBe(false);
    vi.useRealTimers();
  });

  it("hoursRemaining floors at 0 never negative", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-30T18:00:00.000Z"));
    const result = getEscrowProgress(new Date("2026-03-28T00:00:00.000Z"));
    expect(result.hoursRemaining).toBe(0);
    vi.useRealTimers();
  });

  it("percentComplete caps at 100", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-30T18:00:00.000Z"));
    const result = getEscrowProgress(new Date("2026-03-28T00:00:00.000Z"));
    expect(result.percentComplete).toBe(100);
    vi.useRealTimers();
  });

  it("finalityEta is exactly settledAt + finalityHours", () => {
    const settledAt = new Date("2026-03-28T00:00:00.000Z");
    const result = getEscrowProgress(settledAt, 24);
    expect(result.finalityEta).toBe("2026-03-29T00:00:00.000Z");
  });
});
