import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { AnalyticsCategoryStat, TransactionCategory } from '@klyovo/shared'

const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  FOOD_CAFE: 'Еда и кафе',
  GROCERIES: 'Продукты',
  MARKETPLACE: 'Маркетплейс',
  TRANSPORT: 'Транспорт',
  SUBSCRIPTIONS: 'Подписки',
  ENTERTAINMENT: 'Развлечения',
  HEALTH: 'Здоровье',
  CLOTHING: 'Одежда',
  EDUCATION: 'Образование',
  OTHER: 'Прочее'
}

const CATEGORY_EMOJI: Record<TransactionCategory, string> = {
  FOOD_CAFE: '🍕',
  GROCERIES: '🛒',
  MARKETPLACE: '📦',
  TRANSPORT: '🚕',
  SUBSCRIPTIONS: '📱',
  ENTERTAINMENT: '🎭',
  HEALTH: '💊',
  CLOTHING: '👕',
  EDUCATION: '📚',
  OTHER: '💸'
}

const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'
]

interface SpendingChartProps {
  topCategories: AnalyticsCategoryStat[]
  totalKopecks: number
}

export function SpendingChart({ topCategories, totalKopecks }: SpendingChartProps): JSX.Element {
  const data = topCategories.map(cat => ({
    name: CATEGORY_LABELS[cat.category],
    value: Math.round(cat.totalKopecks / 100),
    kopecks: cat.totalKopecks,
    percentage: cat.percentage
  }))

  return (
    <div className="bg-tg-secondary rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-medium text-tg-text">По категориям</p>
        <p className="text-sm font-bold text-tg-text">
          ₽{(totalKopecks / 100).toFixed(0)}
        </p>
      </div>

      {/* Pie chart */}
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={75}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length] ?? '#85C1E9'} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [`₽${value}`, '']}
            contentStyle={{
              background: 'var(--tg-theme-bg-color)',
              border: 'none',
              borderRadius: 12,
              fontSize: 12
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Category list */}
      <div className="space-y-2">
        {topCategories.map((cat, index) => (
          <div key={cat.category} className="flex items-center gap-3">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: COLORS[index % COLORS.length] ?? '#85C1E9' }}
            />
            <span className="text-base">{CATEGORY_EMOJI[cat.category]}</span>
            <span className="flex-1 text-sm text-tg-text truncate">
              {CATEGORY_LABELS[cat.category]}
            </span>
            <span className="text-xs text-tg-hint shrink-0">{cat.percentage}%</span>
            <span className="text-sm font-semibold text-tg-text shrink-0">
              ₽{(cat.totalKopecks / 100).toFixed(0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
