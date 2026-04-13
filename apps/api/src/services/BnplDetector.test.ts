import { describe, it, expect, beforeEach } from '@jest/globals'
import { BnplDetector } from './BnplDetector.js'
import type { Transaction } from './BnplDetector.js'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeTxn(overrides: Partial<Transaction>): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    userId: 'user-1',
    amountKopecks: 250000,
    merchantName: 'DOLYAMI MVIDEO',
    merchantNormalized: 'DOLYAMI MVIDEO',
    category: 'MARKETPLACE',
    source: 'CSV_TBANK',
    rawDescription: null,
    isBnpl: false,
    bnplService: null,
    transactionDate: new Date('2025-01-01'),
    createdAt: new Date('2025-01-01'),
    ...overrides
  }
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86400_000)
}

// ─── detectProvider ───────────────────────────────────────────────────────────

describe('BnplDetector.detectProvider', () => {
  it('detects Долями by DOLYAMI keyword', () => {
    expect(BnplDetector.detectProvider('DOLYAMI MVIDEO')).toBe('Долями')
  })

  it('detects Долями case-insensitively', () => {
    expect(BnplDetector.detectProvider('dolyami lamoda')).toBe('Долями')
  })

  it('detects Сплит by SPLIT keyword', () => {
    expect(BnplDetector.detectProvider('TINKOFF SPLIT ZARA')).toBe('Сплит')
  })

  it('detects Сплит by SPLIT alone', () => {
    expect(BnplDetector.detectProvider('SPLIT WILDBERRIES')).toBe('Сплит')
  })

  it('detects Подели by PODELI keyword', () => {
    expect(BnplDetector.detectProvider('PODELI ELDORADO')).toBe('Подели')
  })

  it('detects Яндекс Сплит', () => {
    expect(BnplDetector.detectProvider('YANDEX SPLIT OZON')).toBe('Яндекс Сплит')
  })

  it('returns null for regular merchant', () => {
    expect(BnplDetector.detectProvider('MAGNIT')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(BnplDetector.detectProvider('')).toBeNull()
  })
})

// ─── detect ───────────────────────────────────────────────────────────────────

describe('BnplDetector.detect', () => {
  it('returns empty array for no transactions', () => {
    expect(BnplDetector.detect([])).toEqual([])
  })

  it('returns empty array for non-BNPL transactions only', () => {
    const txns = [
      makeTxn({ merchantNormalized: 'MAGNIT', amountKopecks: 50000 }),
      makeTxn({ merchantNormalized: 'WILDBERRIES', amountKopecks: 120000 })
    ]
    expect(BnplDetector.detect(txns)).toHaveLength(0)
  })

  it('skips when only 1 BNPL transaction (need ≥2)', () => {
    const txns = [makeTxn({ merchantNormalized: 'DOLYAMI MVIDEO' })]
    expect(BnplDetector.detect(txns)).toHaveLength(0)
  })

  it('detects Долями 14-day pattern (2 payments)', () => {
    const txns = [
      makeTxn({
        merchantNormalized: 'DOLYAMI MVIDEO',
        amountKopecks: 250000,
        transactionDate: new Date('2025-01-01')
      }),
      makeTxn({
        merchantNormalized: 'DOLYAMI MVIDEO',
        amountKopecks: 250000,
        transactionDate: new Date('2025-01-15')
      })
    ]

    const result = BnplDetector.detect(txns)
    expect(result).toHaveLength(1)
    const ob = result[0]!
    expect(ob.bnplService).toBe('Долями')
    expect(ob.frequencyDays).toBe(14)
    expect(ob.totalInstallments).toBe(4) // Долями always 4
    expect(ob.paidInstallments).toBe(2)
    expect(ob.installmentAmount).toBe(250000)
  })

  it('detects Сплит 30-day pattern', () => {
    const txns = [
      makeTxn({
        merchantNormalized: 'TINKOFF SPLIT ZARA',
        amountKopecks: 180000,
        transactionDate: new Date('2025-01-05')
      }),
      makeTxn({
        merchantNormalized: 'TINKOFF SPLIT ZARA',
        amountKopecks: 180000,
        transactionDate: new Date('2025-02-05')
      })
    ]

    const result = BnplDetector.detect(txns)
    expect(result).toHaveLength(1)
    const ob = result[0]!
    expect(ob.bnplService).toBe('Сплит')
    expect(ob.frequencyDays).toBe(30)
    expect(ob.paidInstallments).toBe(2)
    expect(ob.totalInstallments).toBeGreaterThanOrEqual(4)
  })

  it('skips when amount variance >5%', () => {
    const txns = [
      makeTxn({ merchantNormalized: 'DOLYAMI MVIDEO', amountKopecks: 250000, transactionDate: new Date('2025-01-01') }),
      makeTxn({ merchantNormalized: 'DOLYAMI MVIDEO', amountKopecks: 300000, transactionDate: new Date('2025-01-15') })
    ]
    expect(BnplDetector.detect(txns)).toHaveLength(0)
  })

  it('skips non-standard interval (e.g. 45 days)', () => {
    const txns = [
      makeTxn({ merchantNormalized: 'DOLYAMI MVIDEO', amountKopecks: 250000, transactionDate: new Date('2025-01-01') }),
      makeTxn({ merchantNormalized: 'DOLYAMI MVIDEO', amountKopecks: 250000, transactionDate: new Date('2025-02-15') })
    ]
    expect(BnplDetector.detect(txns)).toHaveLength(0)
  })

  it('marks as completed when paidInstallments >= totalInstallments (Долями 4/4)', () => {
    const dates = ['2025-01-01', '2025-01-15', '2025-01-29', '2025-02-12']
    const txns = dates.map(d =>
      makeTxn({
        merchantNormalized: 'DOLYAMI MVIDEO',
        amountKopecks: 250000,
        transactionDate: new Date(d)
      })
    )

    const result = BnplDetector.detect(txns)
    expect(result).toHaveLength(1)
    expect(result[0]!.status).toBe('completed')
    expect(result[0]!.paidInstallments).toBe(4)
    expect(result[0]!.nextPaymentDate).toBeNull()
  })

  it('marks as overdue when nextPaymentDate is in the past', () => {
    const txns = [
      makeTxn({
        merchantNormalized: 'DOLYAMI MVIDEO',
        amountKopecks: 250000,
        transactionDate: daysAgo(60)
      }),
      makeTxn({
        merchantNormalized: 'DOLYAMI MVIDEO',
        amountKopecks: 250000,
        transactionDate: daysAgo(46)
      })
    ]

    const result = BnplDetector.detect(txns)
    expect(result).toHaveLength(1)
    expect(result[0]!.status).toBe('overdue')
  })

  it('marks as active when nextPaymentDate is in the future', () => {
    const txns = [
      makeTxn({
        merchantNormalized: 'DOLYAMI MVIDEO',
        amountKopecks: 250000,
        transactionDate: daysAgo(20)
      }),
      makeTxn({
        merchantNormalized: 'DOLYAMI MVIDEO',
        amountKopecks: 250000,
        transactionDate: daysAgo(6)
      })
    ]

    const result = BnplDetector.detect(txns)
    expect(result).toHaveLength(1)
    expect(result[0]!.status).toBe('active')
  })

  it('handles mixed BNPL and regular transactions', () => {
    const txns = [
      makeTxn({ merchantNormalized: 'MAGNIT', amountKopecks: 50000, transactionDate: new Date('2025-01-10') }),
      makeTxn({ merchantNormalized: 'DOLYAMI MVIDEO', amountKopecks: 250000, transactionDate: new Date('2025-01-01') }),
      makeTxn({ merchantNormalized: 'DOLYAMI MVIDEO', amountKopecks: 250000, transactionDate: new Date('2025-01-15') }),
      makeTxn({ merchantNormalized: 'WILDBERRIES', amountKopecks: 99900, transactionDate: new Date('2025-01-05') })
    ]

    const result = BnplDetector.detect(txns)
    expect(result).toHaveLength(1)
    expect(result[0]!.bnplService).toBe('Долями')
  })

  it('detects two different BNPL obligations independently', () => {
    const txns = [
      makeTxn({ merchantNormalized: 'DOLYAMI MVIDEO', amountKopecks: 250000, transactionDate: new Date('2025-01-01') }),
      makeTxn({ merchantNormalized: 'DOLYAMI MVIDEO', amountKopecks: 250000, transactionDate: new Date('2025-01-15') }),
      makeTxn({ merchantNormalized: 'TINKOFF SPLIT ZARA', amountKopecks: 180000, transactionDate: new Date('2025-01-05') }),
      makeTxn({ merchantNormalized: 'TINKOFF SPLIT ZARA', amountKopecks: 180000, transactionDate: new Date('2025-02-05') })
    ]

    const result = BnplDetector.detect(txns)
    expect(result).toHaveLength(2)
    const providers = result.map(r => r.bnplService).sort()
    expect(providers).toEqual(['Долями', 'Сплит'])
  })
})
