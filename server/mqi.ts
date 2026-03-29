import { createHmac } from 'node:crypto'

export type MqiComponents = {
  peerCitationScore: number
  standardsAlignment: number
  realWorldUsage: number
  outcomeTracking: number
  verifierReputation: number
  academicReferences: number
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

export function gradeFromScore(score: number): string {
  if (score >= 90) return 'AAA'
  if (score >= 80) return 'AA'
  if (score >= 70) return 'A'
  if (score >= 60) return 'BBB'
  if (score >= 50) return 'BB'
  if (score >= 40) return 'B'
  return 'C'
}

export function weightedMqiScore(components: MqiComponents): number {
  const score =
    clampScore(components.peerCitationScore) * 0.25 +
    clampScore(components.standardsAlignment) * 0.2 +
    clampScore(components.realWorldUsage) * 0.2 +
    clampScore(components.outcomeTracking) * 0.2 +
    clampScore(components.verifierReputation) * 0.1 +
    clampScore(components.academicReferences) * 0.05
  return clampScore(Number(score.toFixed(2)))
}

export function signMqiSnapshot(input: unknown, key = process.env.UCPI_SIGNING_KEY || 'dev_ucpi_signing_key') {
  return createHmac('sha256', key).update(JSON.stringify(input)).digest('hex')
}

export function zeroDataComponents(): MqiComponents {
  return {
    peerCitationScore: 0,
    standardsAlignment: 0,
    realWorldUsage: 0,
    outcomeTracking: 0,
    verifierReputation: 0,
    academicReferences: 0,
  }
}
