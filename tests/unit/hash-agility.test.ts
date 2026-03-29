import { describe, it, expect, beforeEach } from 'vitest'
import { getHashAlgorithm, isAlgorithmApproved, hashRecord, validateEscrowFinality } from '../../server/hash-agility'

describe('getHashAlgorithm', () => {
  beforeEach(() => {
    delete process.env.HASH_ALGORITHM
  })

  it('returns env var value when set', () => {
    process.env.HASH_ALGORITHM = 'sha3-256'
    expect(getHashAlgorithm()).toBe('sha3-256')
    delete process.env.HASH_ALGORITHM
  })

  it('returns sha256 when env not set', () => {
    delete process.env.HASH_ALGORITHM
    expect(getHashAlgorithm()).toBe('sha256')
  })
})

describe('isAlgorithmApproved', () => {
  it('returns true for approved algorithm', () => {
    process.env.APPROVED_ALGORITHMS = 'sha256,sha3-256'
    expect(isAlgorithmApproved('sha256')).toBe(true)
  })

  it('returns false for unapproved algorithm', () => {
    process.env.APPROVED_ALGORITHMS = 'sha256'
    expect(isAlgorithmApproved('md5')).toBe(false)
  })
})

describe('hashRecord', () => {
  it('produces consistent output for same input', () => {
    const data = { test: 'value' }
    expect(hashRecord(data)).toBe(hashRecord(data))
  })

  it('produces different output for different input', () => {
    expect(hashRecord({ a: 1 })).not.toBe(hashRecord({ a: 2 }))
  })
})

describe('validateEscrowFinality', () => {
  it('returns settled=true after 24 hours', () => {
    const settledAt = new Date(Date.now() - 25 * 60 * 60 * 1000)
    const result = validateEscrowFinality(settledAt, 'sha256')
    expect(result.settled).toBe(true)
  })

  it('returns settled=false before 24 hours', () => {
    const settledAt = new Date(Date.now() - 12 * 60 * 60 * 1000)
    const result = validateEscrowFinality(settledAt, 'sha256')
    expect(result.settled).toBe(false)
  })

  it('requiresManualReview true when settled and algo deprecated', () => {
    process.env.APPROVED_ALGORITHMS = 'sha3-256'
    const settledAt = new Date(Date.now() - 25 * 60 * 60 * 1000)
    const result = validateEscrowFinality(settledAt, 'sha256')
    expect(result.requiresManualReview).toBe(true)
    expect(result.settled).toBe(true)
  })

  it('never sets requiresManualReview without settled=true', () => {
    process.env.APPROVED_ALGORITHMS = 'sha3-256'
    const settledAt = new Date(Date.now() - 1 * 60 * 60 * 1000)
    const result = validateEscrowFinality(settledAt, 'sha256')
    expect(result.requiresManualReview).toBe(false)
  })

  it('hoursRemaining never goes negative', () => {
    const settledAt = new Date(Date.now() - 100 * 60 * 60 * 1000)
    const result = validateEscrowFinality(settledAt, 'sha256')
    expect(result.hoursRemaining).toBe(0)
  })

  it('percentComplete caps at 100', () => {
    const settledAt = new Date(Date.now() - 100 * 60 * 60 * 1000)
    const result = validateEscrowFinality(settledAt, 'sha256')
    expect(result.percentComplete).toBe(100)
  })
})
