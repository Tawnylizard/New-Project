# Solution Strategy: payments-subscription

## SCQA

- **Situation:** Клёво freemium с 3 roast/мес ограничением работает
- **Complication:** Без оплаты нет выручки, без выручки нет продукта
- **Question:** Как монетизировать российских Gen Z с минимальным трением?
- **Answer:** ЮKassa redirect checkout — пользователь платит на доверенной странице, мы активируем через webhook

## First Principles

1. Деньги должны дойти до нас → нужен надёжный провайдер
2. Трение = потери конверсии → минимум шагов
3. Безопасность = доверие → не хранить карточные данные
4. Идемпотентность = корректность → duplicate-safe webhook

**Вывод:** Redirect checkout (hosted page) оптимален. Мы не храним платёжные данные, минимальный PCI scope.

## Contradictions Resolved (TRIZ)

| Contradiction | TRIZ Principle | Resolution |
|---------------|----------------|------------|
| Хотим контролировать UX vs Не хотим PCI scope | Принцип посредника (#24) | Redirect на ЮKassa, возврат через webhook |
| Хотим мгновенную активацию vs Не хотим двойных активаций | Принцип предварительного действия (#10) | Idempotency check перед транзакцией |

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| ЮKassa API down | LOW | HIGH | 502 ответ, retry на клиенте |
| Webhook delivery failure | MEDIUM | HIGH | ЮKassa ретраит 24ч, idempotent handler |
| Double activation | LOW | HIGH | `yookassaPaymentId` UNIQUE constraint |
| ФЗ-54 нарушение | LOW | CRITICAL | receipt в каждом запросе |
| Env vars отсутствуют | LOW | HIGH | 503 с явным сообщением |
