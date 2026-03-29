import { describe, it, expect } from 'vitest'
import { hashRecord } from '../../server/hash-agility'

type Block = {
  blockNumber: number
  timestamp: string
  algorithm: string
  transactionData: Record<string, unknown>
  prevHash: string
  hash: string
}

function makeBlock(prev: Block | null, tx: Record<string, unknown>, algorithm = 'sha256'): Block {
  const blockNumber = (prev?.blockNumber ?? 0) + 1
  const prevHash = prev?.hash ?? '0000000000000000'
  const timestamp = new Date(1700000000000 + blockNumber * 1000).toISOString()
  const hash = hashRecord({ blockNumber, timestamp, algorithm, transactionData: tx, prevHash }, algorithm)
  return { blockNumber, timestamp, algorithm, transactionData: tx, prevHash, hash }
}

function verifyChain(chain: Block[]): boolean {
  for (let i = 0; i < chain.length; i += 1) {
    const current = chain[i]
    const expectedPrev = i === 0 ? '0000000000000000' : chain[i - 1].hash
    if (current.prevHash !== expectedPrev) return false
    const recomputed = hashRecord({
      blockNumber: current.blockNumber,
      timestamp: current.timestamp,
      algorithm: current.algorithm,
      transactionData: current.transactionData,
      prevHash: current.prevHash,
    }, current.algorithm)
    if (recomputed !== current.hash) return false
  }
  return true
}

describe('audit chain', () => {
  it("genesis block creation (prevHash = '0000000000000000')", () => {
    const genesis = makeBlock(null, { type: 'genesis' })
    expect(genesis.prevHash).toBe('0000000000000000')
  })

  it('block hash computation is deterministic', () => {
    const tx = { type: 'same' }
    expect(makeBlock(null, tx).hash).toBe(makeBlock(null, tx).hash)
  })

  it('chain verification passes for valid chain', () => {
    const b1 = makeBlock(null, { type: 'a' })
    const b2 = makeBlock(b1, { type: 'b' })
    const b3 = makeBlock(b2, { type: 'c' })
    expect(verifyChain([b1, b2, b3])).toBe(true)
  })

  it('chain verification fails after modifying any block field', () => {
    const b1 = makeBlock(null, { type: 'a' })
    const b2 = makeBlock(b1, { type: 'b' })
    const b3 = makeBlock(b2, { type: 'c' })
    b2.transactionData.type = 'tampered'
    expect(verifyChain([b1, b2, b3])).toBe(false)
  })

  it('algorithm field in block matches algorithm used', () => {
    const block = makeBlock(null, { type: 'x' }, 'sha512')
    expect(block.algorithm).toBe('sha512')
  })
})
