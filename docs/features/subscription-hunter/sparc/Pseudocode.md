# Pseudocode: Subscription Hunter

## POST /subscriptions/scan

```
INPUT: userId (from JWT)
OUTPUT: { found: number, subscriptions: EnrichedSub[] }

STEPS:
1. transactions = prisma.transaction.findMany({ where: { userId } })

2. detected = SubscriptionDetector.detect(transactions)
   // Returns: DetectedSub[] with merchantName, estimatedAmount, frequencyDays, lastChargeDate, occurrences

3. FOR EACH detected sub:
   upserted = prisma.detectedSubscription.upsert({
     where: { userId_merchantName: { userId, merchantName: sub.merchantName } },
     create: {
       userId,
       merchantName: sub.merchantName,
       estimatedAmount: sub.estimatedAmount,
       frequencyDays: sub.frequencyDays,
       lastChargeDate: sub.lastChargeDate,
       occurrences: sub.occurrences,
       status: 'active'
     },
     update: {
       estimatedAmount: sub.estimatedAmount,
       frequencyDays: sub.frequencyDays,
       lastChargeDate: sub.lastChargeDate,
       occurrences: sub.occurrences
       // NOTE: do NOT update status — preserve user's choice (cancelled/ignored)
     }
   })

4. allSubs = prisma.detectedSubscription.findMany({ where: { userId } })

5. enriched = allSubs.map(sub => ({
     ...sub,
     annualCost: Math.round(sub.estimatedAmount * (365 / sub.frequencyDays))
   }))

6. RETURN { found: detected.length, subscriptions: enriched }
```

## Key Invariants

- `@@unique([userId, merchantName])` on `DetectedSubscription` ensures no duplicates
- Status is NEVER overwritten on update — user choices are preserved
- Annual cost = `estimatedAmount * (365 / frequencyDays)` — integer arithmetic only
- All amounts in kopecks throughout

## TMA Scan Trigger Logic

```
IF subscriptions.length === 0 AND hasTransactions:
  SHOW "Найти подписки" button
  ON CLICK: call POST /subscriptions/scan
  THEN: invalidate ['subscriptions'] query → refetch
```
