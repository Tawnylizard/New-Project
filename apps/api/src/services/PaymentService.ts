import type { CheckoutResponse, KlyovoSubscriptionPlan } from '@klyovo/shared'

interface CreatePaymentParams {
  userId: string
  userEmail: string
  plan: KlyovoSubscriptionPlan
  amount: number
  returnUrl: string
}

interface YookassaPaymentResponse {
  id: string
  confirmation: {
    type: string
    confirmation_url: string
  }
}

export class PaymentService {
  static async createPayment(params: CreatePaymentParams): Promise<CheckoutResponse> {
    const SHOP_ID = process.env['YUKASSA_SHOP_ID']
    const SECRET_KEY = process.env['YUKASSA_SECRET_KEY']

    if (!SHOP_ID || !SECRET_KEY) {
      throw Object.assign(new Error('ЮKassa не настроена'), { statusCode: 503, code: 'PAYMENT_FAILED' })
    }

    const { userId, userEmail, plan, amount, returnUrl } = params
    // Date-scoped key: deduplicates rapid double-clicks within the same UTC day
    // but allows a new payment on subsequent days (e.g. re-trying after cancellation).
    const utcDate = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const idempotenceKey = `${userId}-${plan}-${utcDate}`

    const amountRub = (amount / 100).toFixed(2)
    const description =
      plan === 'plus_monthly' ? 'Клёво Плюс — 1 месяц' : 'Клёво Плюс — 1 год'

    const credentials = Buffer.from(`${SHOP_ID}:${SECRET_KEY}`).toString('base64')

    const response = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
        'Idempotence-Key': idempotenceKey
      },
      body: JSON.stringify({
        amount: { value: amountRub, currency: 'RUB' },
        confirmation: { type: 'redirect', return_url: returnUrl },
        description,
        receipt: {
          customer: { email: userEmail },
          items: [
            {
              description,
              quantity: '1.00',
              amount: { value: amountRub, currency: 'RUB' },
              vat_code: 1
            }
          ]
        },
        metadata: { userId, plan },
        capture: true
      })
    })

    if (!response.ok) {
      const err = await response.text()
      throw Object.assign(
        new Error(`ЮKassa payment creation failed: ${err}`),
        { statusCode: 502, code: 'PAYMENT_FAILED' }
      )
    }

    const data = (await response.json()) as YookassaPaymentResponse

    return {
      paymentId: data.id,
      confirmationUrl: data.confirmation.confirmation_url,
      amount
    }
  }
}
