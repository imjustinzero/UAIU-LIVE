import { describe, it, expect } from 'vitest'
import { clampScore, gradeFromScore, signMqiSnapshot, weightedMqiScore, zeroDataComponents } from '../../server/mqi'

describe('mqi scoring', () => {
  it('score components each return 0-100', () => {
    expect(clampScore(-1)).toBe(0)
    expect(clampScore(45)).toBe(45)
    expect(clampScore(999)).toBe(100)
  })

  it('weighted sum produces 0-100', () => {
    const score = weightedMqiScore({
      peerCitationScore: 80,
      standardsAlignment: 75,
      realWorldUsage: 70,
      outcomeTracking: 65,
      verifierReputation: 90,
      academicReferences: 100,
    })
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('grade assignment: AAA for 90+, AA for 80-89, etc.', () => {
    expect(gradeFromScore(90)).toBe('AAA')
    expect(gradeFromScore(80)).toBe('AA')
    expect(gradeFromScore(70)).toBe('A')
    expect(gradeFromScore(60)).toBe('BBB')
    expect(gradeFromScore(50)).toBe('BB')
    expect(gradeFromScore(40)).toBe('B')
    expect(gradeFromScore(39.99)).toBe('C')
  })

  it('signature is generated and non-empty', () => {
    const signature = signMqiSnapshot({ methodologyId: 'abc', score: 88 })
    expect(signature).toBeTruthy()
    expect(signature.length).toBeGreaterThan(10)
  })

  it('zero data returns score of 0 not error', () => {
    const score = weightedMqiScore(zeroDataComponents())
    expect(score).toBe(0)
  })
})
