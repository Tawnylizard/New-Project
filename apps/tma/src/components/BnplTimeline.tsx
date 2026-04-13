import type { BnplListResponse } from '@klyovo/shared'

type BnplObligationWithRemaining = BnplListResponse['obligations'][number]

interface TimelineEntry {
  date: Date
  amount: number
  bnplService: string
  merchantDisplay: string
  isOverdue: boolean
  obligationId: string
}

interface BnplTimelineProps {
  obligations: BnplObligationWithRemaining[]
}

function buildTimelineEntries(obligations: BnplObligationWithRemaining[]): TimelineEntry[] {
  const entries: TimelineEntry[] = []
  const now = new Date()

  for (const ob of obligations) {
    if (!ob.nextPaymentDate) continue

    const nextDate = new Date(ob.nextPaymentDate)
    const remaining = ob.totalInstallments - ob.paidInstallments

    // Project all remaining installment dates
    for (let i = 0; i < remaining; i++) {
      const entryDate = new Date(nextDate.getTime() + i * ob.frequencyDays * 86400_000)
      entries.push({
        date: entryDate,
        amount: ob.installmentAmount,
        bnplService: ob.bnplService,
        merchantDisplay: ob.merchantDisplay || ob.merchantName,
        isOverdue: entryDate < now,
        obligationId: ob.id
      })
    }
  }

  return entries.sort((a, b) => a.date.getTime() - b.date.getTime())
}

function groupByMonth(entries: TimelineEntry[]): Map<string, TimelineEntry[]> {
  const groups = new Map<string, TimelineEntry[]>()
  for (const entry of entries) {
    const key = entry.date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
    const group = groups.get(key) ?? []
    group.push(entry)
    groups.set(key, group)
  }
  return groups
}

export function BnplTimeline({ obligations }: BnplTimelineProps): JSX.Element {
  const entries = buildTimelineEntries(obligations)
  const grouped = groupByMonth(entries)

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 space-y-2">
        <p className="text-3xl">📅</p>
        <p className="text-tg-hint text-sm">Нет запланированных платежей</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {Array.from(grouped.entries()).map(([month, monthEntries]) => {
        const monthTotal = monthEntries.reduce((s, e) => s + e.amount, 0)
        const hasOverdue = monthEntries.some(e => e.isOverdue)

        return (
          <div key={month} className="space-y-2">
            {/* Month header */}
            <div className="flex items-center justify-between px-1">
              <p className={`text-xs font-semibold uppercase tracking-wide ${hasOverdue ? 'text-red-500' : 'text-tg-hint'}`}>
                {month}
              </p>
              <p className="text-xs text-tg-hint">
                ₽{(monthTotal / 100).toFixed(0)}
              </p>
            </div>

            {/* Entries */}
            <div className="space-y-2">
              {monthEntries.map((entry, idx) => (
                <div
                  key={`${entry.obligationId}-${idx}`}
                  className={`bg-tg-secondary rounded-xl p-3 flex items-center gap-3 ${entry.isOverdue ? 'border border-red-200' : ''}`}
                >
                  {/* Date badge */}
                  <div className={`text-center min-w-[40px] ${entry.isOverdue ? 'text-red-500' : 'text-tg-button'}`}>
                    <p className="text-lg font-bold leading-none">
                      {entry.date.getDate()}
                    </p>
                    <p className="text-xs">
                      {entry.date.toLocaleDateString('ru-RU', { weekday: 'short' })}
                    </p>
                  </div>

                  {/* Divider */}
                  <div className={`w-px h-8 ${entry.isOverdue ? 'bg-red-200' : 'bg-tg-bg'}`} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-tg-text truncate">
                      {entry.merchantDisplay}
                    </p>
                    <p className="text-xs text-tg-hint">{entry.bnplService}</p>
                  </div>

                  {/* Amount */}
                  <p className={`text-sm font-bold ${entry.isOverdue ? 'text-red-500' : 'text-tg-text'}`}>
                    ₽{(entry.amount / 100).toFixed(0)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
