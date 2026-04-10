import type { Transaction } from '@klyovo/db'

export interface DetectedSub {
  merchantName: string
  estimatedAmount: number
  frequencyDays: number
  lastChargeDate: Date
  occurrences: number
}

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

export class SubscriptionDetector {
  static detect(transactions: Transaction[]): DetectedSub[] {
    // Group by normalized merchant name
    const groups = new Map<string, Transaction[]>()

    for (const txn of transactions) {
      const key = txn.merchantNormalized
      const group = groups.get(key) ?? []
      group.push(txn)
      groups.set(key, group)
    }

    const subscriptions: DetectedSub[] = []

    for (const [merchant, txns] of groups) {
      if (txns.length < 2) continue

      // Sort ascending by date
      const sorted = [...txns].sort(
        (a, b) => a.transactionDate.getTime() - b.transactionDate.getTime()
      )

      // Compute gaps in days
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

      let frequencyDays: number
      if (avgGap >= 25 && avgGap <= 35) {
        frequencyDays = 30
      } else if (avgGap >= 6 && avgGap <= 8) {
        frequencyDays = 7
      } else {
        continue
      }

      // Check amount stability (stddev/mean < 10%)
      const amounts = sorted.map(t => t.amountKopecks)
      const avg = mean(amounts)
      if (avg === 0) continue
      if (stddev(amounts) / avg > 0.1) continue

      const lastTxn = sorted[sorted.length - 1]
      if (!lastTxn) continue

      subscriptions.push({
        merchantName: merchant,
        estimatedAmount: Math.round(avg),
        frequencyDays,
        lastChargeDate: lastTxn.transactionDate,
        occurrences: txns.length
      })
    }

    return subscriptions
  }
}
