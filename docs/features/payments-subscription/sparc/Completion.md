# Completion: payments-subscription

## Pre-Deployment Checklist

- [ ] YUKASSA_SHOP_ID set in Yandex Lockbox
- [ ] YUKASSA_SECRET_KEY set in Yandex Lockbox
- [ ] Webhook URL registered in ЮKassa dashboard: POST /webhooks/yukassa
- [ ] ЮKassa Sandbox tested end-to-end
- [ ] All tests passing (checkout + webhook routes)
- [ ] planExpiresAt date math verified (30d / 365d)

## Deployment Sequence

1. Deploy API with new GET /subscriptions/status route
2. Verify /health passes
3. Register webhook URL in ЮKassa dashboard
4. Test with ЮKassa Sandbox payment
5. Verify KlyovoSubscription created + user.plan = PLUS

## Monitoring

| Metric | Threshold | Alert |
|--------|-----------|-------|
| POST /subscriptions/checkout p95 | > 3s | Slack |
| POST /webhooks/yukassa 4xx rate | > 0% | PagerDuty |
| KlyovoSubscription creation failures | > 0 | PagerDuty |

## Rollback

If webhook processing fails:
1. Check logs: `app.log.error` + `app.log.warn` at webhook handler
2. ЮKassa retries for 24h — fix issue within window
3. Manual reprocessing: query ЮKassa API by paymentId, manually activate
