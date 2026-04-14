# Research Findings: payments-subscription

## Executive Summary

ЮKassa — единственный жизнеспособный выбор для российского B2C SaaS с поддержкой МИР/СБП/ЮMoney. Redirect checkout минимизирует PCI scope. ФЗ-54 требует чек в каждом платеже.

## Market Analysis

**Российские платёжные провайдеры (2025):**
- **ЮKassa** — лидер рынка, поддержка МИР/СБП/ЮMoney, хорошая документация, Sandbox
- **Robokassa** — альтернатива, но сложнее интеграция
- **CloudPayments** — нет поддержки СБП на момент исследования
- **Stripe/PayPal** — недоступны в РФ с 2022

**Вывод:** ЮKassa — единственный разумный выбор. Confidence: HIGH.

## Technology Assessment

**ЮKassa v3 API:**
- Basic auth (shopId:secretKey) — не OAuth, просто
- Idempotence-Key header — встроенная защита от дублей
- Webhook: Basic auth от ЮKassa → нам, не HMAC-подпись
- ФЗ-54: `receipt` обязателен при наличии email/телефона
- Sandbox: api.yookassa.ru/v3 с test shopId

**Confidence:** HIGH (официальная документация ЮKassa).

## Key Constraints

1. Webhook auth = Basic (не HMAC) — важно для реализации
2. Сумма в API = рубли с 2 знаками, у нас внутри копейки
3. `capture: true` — автозахват, не двухэтапная оплата
4. Receipt `vat_code: 1` — без НДС (ИП/самозанятый)

## Sources

1. ЮKassa API v3 Documentation — https://yookassa.ru/developers/api — reliability: HIGH (official)
2. ФЗ-54 "О применении ККТ" — reliability: HIGH (legal)
3. Cleo.com monetization case studies — reliability: MEDIUM (indirect)
