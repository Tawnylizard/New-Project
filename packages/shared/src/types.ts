// ─── Enums ────────────────────────────────────────────────────────────────────

export type Plan = 'FREE' | 'PLUS'

export type TransactionCategory =
  | 'FOOD_CAFE'
  | 'GROCERIES'
  | 'MARKETPLACE'
  | 'TRANSPORT'
  | 'SUBSCRIPTIONS'
  | 'ENTERTAINMENT'
  | 'HEALTH'
  | 'CLOTHING'
  | 'EDUCATION'
  | 'OTHER'

export type TransactionSource = 'CSV_SBER' | 'CSV_TBANK' | 'MANUAL'

export type BnplService = 'dolyami' | 'split' | 'podeli'

export type SubscriptionStatus = 'active' | 'cancelled' | 'ignored'

export type KlyovoSubscriptionPlan = 'plus_monthly' | 'plus_yearly'

export type KlyovoSubscriptionStatus = 'active' | 'cancelled' | 'expired'

export type RoastMode = 'harsh' | 'soft'

export type AnalyticsPeriod = 'month' | 'last_month' | '3months'

export interface AnalyticsCategoryStat {
  category: TransactionCategory
  totalKopecks: number
  percentage: number
  transactionCount: number
}

export interface AnalyticsSummaryResponse {
  period: { from: string; to: string }
  totalKopecks: number
  previousTotalKopecks: number
  changePercent: number | null
  topCategories: AnalyticsCategoryStat[]
  transactionCount: number
}

// ─── Core domain types ────────────────────────────────────────────────────────

export interface User {
  id: string
  telegramId: bigint
  telegramUsername: string | null
  displayName: string
  plan: Plan
  planExpiresAt: Date | null
  referralCode: string
  referredBy: string | null
  consentGivenAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface Transaction {
  id: string
  userId: string
  amountKopecks: number
  merchantName: string
  merchantNormalized: string
  category: TransactionCategory
  transactionDate: Date
  source: TransactionSource
  rawDescription: string | null
  isBnpl: boolean
  bnplService: BnplService | null
  createdAt: Date
}

export interface SpendingSummary {
  periodStart: Date
  periodEnd: Date
  totalAmount: number
  topCategories: Array<{
    category: TransactionCategory
    amount: number
    percentage: number
  }>
  subscriptionsFound: number
  bnplTotal: number
}

export interface RoastSession {
  id: string
  userId: string
  roastText: string
  spendingSummary: SpendingSummary
  mode: RoastMode
  sharedAt: Date | null
  createdAt: Date
}

export interface DetectedSubscription {
  id: string
  userId: string
  merchantName: string
  estimatedAmount: number
  frequencyDays: number
  lastChargeDate: Date
  occurrences: number
  status: SubscriptionStatus
  createdAt: Date
}

export interface KlyovoSubscription {
  id: string
  userId: string
  plan: KlyovoSubscriptionPlan
  status: KlyovoSubscriptionStatus
  yookassaPaymentId: string
  startedAt: Date
  expiresAt: Date
  createdAt: Date
}

// ─── API request/response types ───────────────────────────────────────────────

export interface AuthTelegramRequest {
  initData: string
}

export interface AuthTelegramResponse {
  token: string
  user: {
    id: string
    displayName: string
    plan: Plan
    planExpiresAt: string | null
    referralCode: string
  }
}

export interface ImportTransactionsResponse {
  importedCount: number
  period: { from: string; to: string }
  categoriesSummary: Array<{ category: TransactionCategory; total: number }>
}

export interface GenerateRoastRequest {
  mode: RoastMode
  periodDays: 30 | 60 | 90
}

export interface GenerateRoastResponse {
  roastId: string
  roastText: string
  spendingSummary: SpendingSummary
  shareUrl: string
}

export interface SubscriptionListResponse {
  subscriptions: Array<
    DetectedSubscription & {
      annualCost: number
    }
  >
  totalMonthly: number
  totalAnnual: number
}

export interface CheckoutRequest {
  plan: KlyovoSubscriptionPlan
  returnUrl: string
}

export interface CheckoutResponse {
  paymentId: string
  confirmationUrl: string
  amount: number
}

// ─── Error types ──────────────────────────────────────────────────────────────

export type ApiErrorCode =
  | 'INVALID_INIT_DATA'
  | 'EXPIRED_INIT_DATA'
  | 'PARSE_ERROR'
  | 'FILE_TOO_LARGE'
  | 'PLAN_LIMIT'
  | 'LLM_UNAVAILABLE'
  | 'PAYMENT_FAILED'
  | 'RATE_LIMIT'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'INTERNAL_ERROR'

export interface ApiError {
  error: {
    code: ApiErrorCode
    message: string
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const PLUS_MONTHLY_PRICE_KOPECKS = 19900
export const PLUS_YEARLY_PRICE_KOPECKS = 149000
export const FREE_ROAST_LIMIT_PER_MONTH = 3
export const MAX_CSV_SIZE_BYTES = 5 * 1024 * 1024
export const JWT_TTL_SECONDS = 7 * 24 * 60 * 60
export const INIT_DATA_MAX_AGE_SECONDS = 86400
