import type { Prisma } from '@klyovo/db'

export type Transaction = Prisma.TransactionGetPayload<object>

export interface DetectedBnpl {
  bnplService: string
  merchantName: string
  merchantDisplay: string
  installmentAmount: number
  totalInstallments: number
  paidInstallments: number
  firstPaymentDate: Date
  lastPaymentDate: Date
  nextPaymentDate: Date | null
  frequencyDays: number
  status: 'active' | 'completed' | 'overdue' | 'dismissed'
}

// ─── Provider keyword dictionary ──────────────────────────────────────────────

// Order matters: more specific providers must come before generic ones
// (e.g. 'Яндекс Сплит' before 'Сплит' since 'YANDEX SPLIT' contains 'SPLIT')
const PROVIDER_KEYWORDS: Record<string, string[]> = {
  'Долями': ['DOLYAMI', 'ДОЛЯМИ', 'ЯНДЕКС ДОЛЯМИ', 'DOLYAMI.RU'],
  'Яндекс Сплит': ['YANDEX SPLIT', 'ЯНДЕКС СПЛИТ', 'YA.SPLIT'],
  'Сплит': ['TINKOFF SPLIT', 'SPLIT', 'СПЛИТ', 'Т-СПЛИТ', 'T-SPLIT', 'TSPLIT'],
  'Подели': ['PODELI', 'ПОДЕЛИ', 'СБЕР ПОДЕЛИ', 'SBER PODELI'],
}

// Providers that always use 4 installments
const FOUR_INSTALLMENT_PROVIDERS = new Set(['Долями', 'Подели'])
// Default for unknown installment count
const DEFAULT_INSTALLMENTS = 6

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0
  const avg = mean(values)
  const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length
  return Math.sqrt(variance)
}

// ─── Public API ───────────────────────────────────────────────────────────────

export class BnplDetector {
  /**
   * Detect which BNPL provider (if any) is referenced in a merchant name.
   * Returns null if no known provider is found.
   */
  static detectProvider(merchantName: string): string | null {
    const normalized = merchantName.toUpperCase().trim()
    for (const [provider, keywords] of Object.entries(PROVIDER_KEYWORDS)) {
      for (const keyword of keywords) {
        if (normalized.includes(keyword)) {
          return provider
        }
      }
    }
    return null
  }

  /**
   * Extract a human-readable merchant display name by stripping the provider prefix.
   * e.g. "DOLYAMI MVIDEO" → "MVIDEO"
   */
  static extractMerchantDisplay(merchantName: string, provider: string): string {
    const upper = merchantName.toUpperCase().trim()
    const keywords = PROVIDER_KEYWORDS[provider] ?? []
    for (const keyword of keywords) {
      if (upper.startsWith(keyword)) {
        return merchantName.slice(keyword.length).trim() || merchantName
      }
    }
    return merchantName
  }

  /**
   * Scan a list of transactions and detect BNPL obligations.
   * Returns one DetectedBnpl per identified BNPL group.
   */
  static detect(transactions: Transaction[]): DetectedBnpl[] {
    // Step 1: filter to BNPL-only transactions
    const bnplTxns = transactions.filter(
      t => BnplDetector.detectProvider(t.merchantNormalized) !== null
    )

    // Step 2: group by (provider :: merchantNormalized :: amountBucket)
    const groups = new Map<string, { provider: string; txns: Transaction[] }>()

    for (const txn of bnplTxns) {
      const provider = BnplDetector.detectProvider(txn.merchantNormalized)!
      // Round to nearest 100 kopecks to handle minor per-payment differences
      const amountBucket = Math.round(txn.amountKopecks / 100) * 100
      const key = `${provider}::${txn.merchantNormalized}::${amountBucket}`

      const entry = groups.get(key) ?? { provider, txns: [] }
      entry.txns.push(txn)
      groups.set(key, entry)
    }

    const obligations: DetectedBnpl[] = []

    for (const [, { provider, txns }] of groups) {
      // Need at least 2 data points to identify a pattern
      if (txns.length < 2) continue

      // Sort by date ascending
      const sorted = [...txns].sort(
        (a, b) => a.transactionDate.getTime() - b.transactionDate.getTime()
      )

      // Compute gaps between consecutive payments (in days)
      const gaps: number[] = []
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1]
        const curr = sorted[i]
        if (!prev || !curr) continue
        const diffMs = curr.transactionDate.getTime() - prev.transactionDate.getTime()
        gaps.push(diffMs / (1000 * 60 * 60 * 24))
      }

      if (gaps.length === 0) continue

      const avgGap = mean(gaps)

      // Determine frequency bucket: ~14 days or ~30 days
      let frequencyDays: number
      if (avgGap >= 12 && avgGap <= 16) {
        frequencyDays = 14
      } else if (avgGap >= 26 && avgGap <= 35) {
        frequencyDays = 30
      } else {
        continue // Not a BNPL pattern
      }

      // Verify amount stability: stddev/mean < 5%
      const amounts = sorted.map(t => t.amountKopecks)
      const avg = mean(amounts)
      if (avg === 0) continue
      if (stddev(amounts) / avg > 0.05) continue

      const installmentAmount = Math.round(avg)
      const paidInstallments = sorted.length
      const totalInstallments = FOUR_INSTALLMENT_PROVIDERS.has(provider)
        ? 4
        : Math.max(paidInstallments + 2, DEFAULT_INSTALLMENTS)

      const firstTxn = sorted[0]!
      const lastTxn = sorted[sorted.length - 1]!

      const firstPaymentDate = firstTxn.transactionDate
      const lastPaymentDate = lastTxn.transactionDate

      // Project next payment date
      const nextPaymentDate = new Date(lastPaymentDate.getTime() + frequencyDays * 86400 * 1000)

      // Determine status
      let status: DetectedBnpl['status']
      if (paidInstallments >= totalInstallments) {
        status = 'completed'
      } else if (nextPaymentDate < new Date()) {
        status = 'overdue'
      } else {
        status = 'active'
      }

      const merchantDisplay = BnplDetector.extractMerchantDisplay(
        lastTxn.merchantNormalized,
        provider
      )

      obligations.push({
        bnplService: provider,
        merchantName: lastTxn.merchantNormalized,
        merchantDisplay,
        installmentAmount,
        totalInstallments,
        paidInstallments,
        firstPaymentDate,
        lastPaymentDate,
        nextPaymentDate: paidInstallments >= totalInstallments ? null : nextPaymentDate,
        frequencyDays,
        status
      })
    }

    return obligations
  }
}
