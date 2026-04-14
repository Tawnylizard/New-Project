# PRD: Клёво Плюс — Подписка и Монетизация

**Feature:** payments-subscription  
**Version:** 1.0  
**Date:** 2026-04-14  
**Status:** Implementation in progress

---

## Problem Statement

Клёво — freemium продукт. Бесплатный план ограничивает пользователей 3 roast-сессиями в месяц. Для монетизации и обеспечения MAU → платящий пользователь конверсии нужен полноценный платёжный флоу с российскими методами оплаты.

## Solution

Подписка «Клёво Плюс» через ЮKassa — единственный серьёзный российский платёжный провайдер с поддержкой МИР, СБП и ЮMoney.

## Target Users

Gen Z 18–28 лет, активные пользователи с ≥3 CSV-импортами в месяц, понявшие ценность продукта.

## Business Goals

| Метрика | Цель |
|---------|------|
| Платные подписчики (3 мес) | 250 (5% конверсия от 5K MAU) |
| ARPU | ₽199/мес |
| MRR (3 мес) | ₽49,750 |
| Конверсия Paywall → Payment | ≥15% |

## Feature Scope (MVP)

### In Scope
- `POST /subscriptions/checkout` — создать ЮKassa payment, вернуть confirmation_url
- `POST /webhooks/yukassa` — обработать payment.succeeded, активировать подписку
- `GET /subscriptions/status` — текущий план пользователя, дата истечения
- Paywall TMA (уже реализована)
- Планы: plus_monthly (₽199) и plus_yearly (₽1490)
- Методы оплаты: МИР, СБП, ЮMoney (через ЮKassa)
- Idempotency: один payment_id → один раз

### Out of Scope (v2)
- Автопродление (recurring payments API ЮKassa)
- Частичный возврат
- Промокоды / скидки
- Семейная подписка
- Биллинговый портал

## Pricing

| Plan | Price | Period |
|------|-------|--------|
| plus_monthly | ₽199 (19900 копеек) | 30 дней |
| plus_yearly | ₽1490 (149000 копеек) | 365 дней |

## Constraints

1. ЮKassa v3 API — Basic auth (shopId:secretKey)
2. Webhook: Basic auth от ЮKassa, не HMAC
3. ФЗ-54: все платежи с чеком (receipt в запросе)
4. Без Visa/Mastercard — только МИР/СБП/ЮMoney
5. Все суммы в копейках внутри системы, в рублях в ЮKassa API
