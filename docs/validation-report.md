# Validation Report — «Клёво»

> Phase 2 · Requirements Validation · INVEST + SMART + Security  
> Дата: 2026-04-09 · Итерация: 1/3

---

## Summary

| Показатель | Значение |
|---|---|
| Stories проанализировано | 9 |
| Средний балл | 76.9 / 100 |
| Blocked (< 50) | 0 |
| Warnings | 3 |
| Итерации | 1 |
| **Verdict** | **🟡 CAVEATS** |

---

## Results Table

| Story | Название | Score | INVEST | SMART | Security | Статус |
|---|---|---|---|---|---|---|
| US-001 | Первый запуск без регистрации | 74/100 | 6/6 ✓ | 4/5 | n/a | READY |
| US-002 | Авторизация через Telegram | 85/100 | 6/6 ✓ | 5/5 ✓ | +5 ✓ | READY |
| US-003 | Импорт CSV-выписки | 85/100 | 6/6 ✓ | 5/5 ✓ | +5 ✓ | READY |
| US-004 | Ручной ввод трат | 74/100 | 6/6 ✓ | 4/5 | n/a | READY |
| US-005 | AI Roast Mode | 75/100 | 6/6 ✓ | 5/5 ✓ | n/a | READY ⚠️ |
| US-006 | Подписки-паразиты | 74/100 | 6/6 ✓ | 4/5 | n/a | READY |
| US-007 | BNPL-трекер | **74/100** | 6/6 ✓ | 4/5 | n/a | READY ✅ fixed |
| US-008 | Подписка Клёво Плюс | 85/100 | 6/6 ✓ | 5/5 ✓ | +5 ✓ | READY |
| US-009 | Шеринг roast | 74/100 | 6/6 ✓ | 4/5 | n/a | READY |

**Average: 76.9 / 100**

---

## Warnings (не блокируют)

### ⚠️ W-001: US-005 — «humorous but not offensive» не тестируемо напрямую
**Story:** US-005 Roast Mode  
**AC:** "the roast is humorous but not offensive or demeaning"  
**Issue:** Нет конкретного критерия — зависит от субъективной оценки.  
**Митигация:** В prompt engineering (Architecture.md) прописано: "Не оскорбляй, не матерись." 
Реализуется через system prompt + content moderation в RoastGenerator. В тестах проверяется regex-фильтр запрещённых слов.  
**Action:** Принято — модерация на уровне LLM prompt, не AC.

---

### ⚠️ W-002: US-004, US-006, US-009 — частичный SMART T (Time-bound)
**Stories:** US-004 (исправлено: "within 1 second"), US-006 (нет response time), US-009 (нет timing для уведомления)  
**Issue:** Отсутствует явный timing в некоторых AC.  
**Митигация:** NFRs в Specification.md покрывают общие SLA: API p99 < 500ms, Dashboard < 2s.  
**Action:** Принято — global NFR применим. US-004 исправлен.

---

### ⚠️ W-003: Architecture — отклонение от pipeline constraint (VPS+Docker → Yandex Cloud Serverless)
**Issue:** Pipeline constraint предполагает Docker + Docker Compose на VPS, но архитектура использует Yandex Cloud Serverless Functions.  
**Обоснование:** Регуляторное требование ФЗ-152 + отсутствие собственного DevOps ресурса на MVP. Зафиксировано в ADR-002.  
**Action:** Принято — валидное отклонение. Serverless = managed scaling, ФЗ-152 compliant. CI/CD через GitHub Actions адаптируется под `yc serverless function deploy`.

---

## Scoring Details

### INVEST Analysis

Все 9 user stories: **6/6 INVEST** ✓

| Критерий | Результат | Замечания |
|---|---|---|
| Independent | 9/9 ✓ | Каждая история развёртывается отдельно |
| Negotiable | 9/9 ✓ | AC открыты к обсуждению |
| Valuable | 9/9 ✓ | Все имеют явный "so that" |
| Estimable | 9/9 ✓ | Скоп понятен |
| Small | 9/9 ✓ | Каждая влезает в 1–2 недели |
| Testable | 9/9 ✓ | После фиксов US-007 |

### SMART Analysis

| Story | S | M | A | R | T | Score |
|---|---|---|---|---|---|---|
| US-001 | ✓ | ✓ | ✓ | ✓ | ✗ | 4/5 |
| US-002 | ✓ | ✓ | ✓ | ✓ | ✓ | 5/5 |
| US-003 | ✓ | ✓ | ✓ | ✓ | ✓ | 5/5 |
| US-004 | ✓ | ✓ | ✓ | ✓ | ✓* | 4/5→5/5 |
| US-005 | ✓ | ✓ | ✓ | ✓ | ✓ | 5/5 |
| US-006 | ✓ | ✓ | ✓ | ✓ | ✗ | 4/5 |
| US-007 | ✓* | ✓ | ✓ | ✓ | ✓* | 4/5 |
| US-008 | ✓ | ✓ | ✓ | ✓ | ✓ | 5/5 |
| US-009 | ✓ | ✓ | ✓ | ✓ | ✗ | 4/5 |

*\* = исправлено в Iteration 1*

### Security Checks

| Story | Auth | Input Validation | Data Protection | Webhook | Score |
|---|---|---|---|---|---|
| US-002 | ✓ HMAC-SHA256 | ✓ initData expiry | ✓ JWT 7d | n/a | +5 |
| US-003 | ✓ JWT required | ✓ file size, type | ✓ CSV deleted after parse | n/a | +5 |
| US-008 | ✓ JWT required | ✓ plan validation | ✓ payment via ЮKassa | ✓ idempotency (Refinement.md) | +5 |

---

## Cross-Document Coherence

| Check | Результат |
|---|---|
| PRD features ↔ Specification stories | ✓ Все 8 MVP-фич покрыты stories |
| Performance NFR (Spec) ↔ Benchmarks (Refinement) | ✓ Roast < 5s в обоих документах |
| Auth flow (Architecture) ↔ US-002 AC | ✓ HMAC-SHA256, 401 error match |
| Payment flow (Architecture) ↔ US-008 AC | ✓ ЮKassa webhook → plan unlock in 5s |
| Edge cases (Refinement) ↔ Stories | ✓ CSV edge cases покрыты US-003 AC |
| DB schema (Architecture) ↔ Pseudocode | ✓ Transaction model consistent |

**Contradictions found: 0**

---

## Fixes Applied (Iteration 1)

| Fix | Файл | Изменение |
|---|---|---|
| US-007 BNPL patterns | `docs/Specification.md` | Добавлены конкретные keyword patterns (DOLAMI, SPLIT, PODELI) |
| US-007 response time | `docs/Specification.md` | "within 2 seconds" добавлено |
| US-007 empty state | `docs/Specification.md` | Добавлен AC для 0 BNPL транзакций |
| US-004 timing | `docs/Specification.md` | "immediately" → "within 1 second" |

---

## Exit Criteria

| Критерий | Статус |
|---|---|
| All scores ≥ 50 | ✅ Минимум 74/100 |
| Average ≥ 70 | ✅ 76.9/100 |
| No contradictions | ✅ 0 найдено |
| No BLOCKED items | ✅ 0 blocked |
| Warnings documented | ✅ 3 warnings с митигацией |

**Verdict: 🟡 CAVEATS — proceed to Phase 3 (Toolkit) with noted limitations**
