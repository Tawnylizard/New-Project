import { SubscriptionDetector } from './SubscriptionDetector.js'
import type { Transaction } from './SubscriptionDetector.js'

function makeTxn(overrides: Partial<Transaction> & { transactionDate: Date }): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    userId: 'user-1',
    amountKopecks: 99900,
    merchantName: 'Netflix',
    merchantNormalized: 'netflix',
    category: 'SUBSCRIPTIONS' as const,
    source: 'CSV_TBANK' as const,
    rawDescription: null,
    isBnpl: false,
    bnplService: null,
    createdAt: new Date(),
    ...overrides
  }
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000)
}

describe('SubscriptionDetector', () => {
  it('detects monthly subscription (gap ~30 days)', () => {
    const txns: Transaction[] = [
      makeTxn({ transactionDate: daysAgo(90) }),
      makeTxn({ transactionDate: daysAgo(60) }),
      makeTxn({ transactionDate: daysAgo(30) })
    ]
    const result = SubscriptionDetector.detect(txns)
    expect(result).toHaveLength(1)
    expect(result[0]?.frequencyDays).toBe(30)
    expect(result[0]?.merchantName).toBe('netflix')
    expect(result[0]?.occurrences).toBe(3)
  })

  it('detects weekly subscription (gap ~7 days)', () => {
    const txns: Transaction[] = [
      makeTxn({ merchantName: 'Spotify', merchantNormalized: 'spotify', transactionDate: daysAgo(21) }),
      makeTxn({ merchantName: 'Spotify', merchantNormalized: 'spotify', transactionDate: daysAgo(14) }),
      makeTxn({ merchantName: 'Spotify', merchantNormalized: 'spotify', transactionDate: daysAgo(7) })
    ]
    const result = SubscriptionDetector.detect(txns)
    expect(result).toHaveLength(1)
    expect(result[0]?.frequencyDays).toBe(7)
  })

  it('ignores merchants with only one transaction', () => {
    const txns: Transaction[] = [
      makeTxn({ merchantNormalized: 'ozon', transactionDate: daysAgo(15) })
    ]
    const result = SubscriptionDetector.detect(txns)
    expect(result).toHaveLength(0)
  })

  it('ignores irregular charge patterns (not ~7 or ~30 day gaps)', () => {
    const txns: Transaction[] = [
      makeTxn({ merchantNormalized: 'random-store', transactionDate: daysAgo(50) }),
      makeTxn({ merchantNormalized: 'random-store', transactionDate: daysAgo(20) }),
      makeTxn({ merchantNormalized: 'random-store', transactionDate: daysAgo(5) })
    ]
    const result = SubscriptionDetector.detect(txns)
    expect(result).toHaveLength(0)
  })

  it('ignores merchants with highly variable amounts (stddev > 10%)', () => {
    const txns: Transaction[] = [
      makeTxn({ merchantNormalized: 'variable-shop', amountKopecks: 10000, transactionDate: daysAgo(60) }),
      makeTxn({ merchantNormalized: 'variable-shop', amountKopecks: 50000, transactionDate: daysAgo(30) })
    ]
    const result = SubscriptionDetector.detect(txns)
    expect(result).toHaveLength(0)
  })

  it('returns estimated amount as average of charges', () => {
    const txns: Transaction[] = [
      makeTxn({ amountKopecks: 99900, transactionDate: daysAgo(60) }),
      makeTxn({ amountKopecks: 99900, transactionDate: daysAgo(30) })
    ]
    const result = SubscriptionDetector.detect(txns)
    expect(result[0]?.estimatedAmount).toBe(99900)
  })

  it('returns empty array for empty transaction list', () => {
    expect(SubscriptionDetector.detect([])).toHaveLength(0)
  })

  it('handles multiple subscriptions from different merchants', () => {
    const txns: Transaction[] = [
      makeTxn({ merchantName: 'Netflix', merchantNormalized: 'netflix', transactionDate: daysAgo(60) }),
      makeTxn({ merchantName: 'Netflix', merchantNormalized: 'netflix', transactionDate: daysAgo(30) }),
      makeTxn({ merchantName: 'Spotify', merchantNormalized: 'spotify', amountKopecks: 29900, transactionDate: daysAgo(60) }),
      makeTxn({ merchantName: 'Spotify', merchantNormalized: 'spotify', amountKopecks: 29900, transactionDate: daysAgo(30) })
    ]
    const result = SubscriptionDetector.detect(txns)
    expect(result).toHaveLength(2)
  })
})
