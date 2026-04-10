import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { Transaction, TransactionCategory } from '@klyovo/shared'

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

const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
]

interface SpendingChartProps {
  transactions: Transaction[]
}

export function SpendingChart({ transactions }: SpendingChartProps): JSX.Element {
  const categorySums = new Map<TransactionCategory, number>()
  for (const t of transactions) {
    const cat = t.category
    categorySums.set(cat, (categorySums.get(cat) ?? 0) + t.amountKopecks)
  }

  const data = Array.from(categorySums.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([category, amount]) => ({
      name: CATEGORY_LABELS[category],
      value: Math.round(amount / 100),
      kopecks: amount
    }))

  const total = data.reduce((s, d) => s + d.kopecks, 0)

  return (
    <div className="bg-tg-secondary rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-medium text-tg-text">Траты по категориям</p>
        <p className="text-sm font-bold text-tg-text">₽{(total / 100).toFixed(0)}</p>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length] ?? '#85C1E9'} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [`₽${value}`, '']}
            contentStyle={{ background: 'var(--tg-theme-bg-color)', border: 'none', borderRadius: 12 }}
          />
          <Legend iconType="circle" iconSize={8} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
