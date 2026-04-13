# Specification: Subscription Hunter

## User Stories

### US-01: Trigger Subscription Scan
As a Клёво user,
I want to trigger a scan of my transactions for subscriptions,
So that the app finds all my recurring payments automatically.

**Acceptance Criteria:**
```gherkin
Given I have uploaded transactions for 2+ months
When I tap "Найти подписки" on the Subscriptions page
Then the app calls POST /subscriptions/scan
And detected subscriptions are saved to DB
And I see the list of detected subscriptions
```

### US-02: View Subscription Costs
As a user,
I want to see monthly and annual cost of each subscription,
So that I understand the full financial impact.

**Acceptance Criteria:**
```gherkin
Given I have active detected subscriptions
When I open the Subscriptions page
Then I see per-subscription: name, amount, frequency, annual cost
And I see total monthly and annual cost at the top
```

### US-03: Mark as Parasite
As a user,
I want to mark a subscription as "parasite" (unwanted),
So that I can track which ones I need to cancel.

**Acceptance Criteria:**
```gherkin
Given I see a subscription with status "active"
When I tap "Это паразит"
Then the subscription status changes to "cancelled"
And it becomes visually dimmed in the UI
```

## API Specification

### POST /subscriptions/scan

**Auth:** Required (JWT)

**Request:** empty body

**Process:**
1. Fetch all user transactions from DB
2. Run `SubscriptionDetector.detect(transactions)`
3. For each detected subscription: upsert into `DetectedSubscription` table
   - Key: `(userId, merchantName)` — unique constraint
   - Update: `estimatedAmount`, `frequencyDays`, `lastChargeDate`, `occurrences`
   - Preserve existing `status` if record already exists
4. Return scan result

**Response 200:**
```json
{
  "found": 3,
  "subscriptions": [
    {
      "id": "uuid",
      "merchantName": "netflix",
      "estimatedAmount": 99900,
      "frequencyDays": 30,
      "lastChargeDate": "2024-03-15T00:00:00.000Z",
      "occurrences": 3,
      "status": "active",
      "annualCost": 1198800,
      "createdAt": "2024-03-15T00:00:00.000Z"
    }
  ]
}
```

**Response 401:** Unauthorized

## Non-Functional Requirements

- Scan latency: p95 < 500ms for 1 000 transactions
- Upsert is idempotent: running scan twice doesn't create duplicates
- Thread-safe: concurrent scans for same user are safe (upsert semantics)

## Feature Flags

None — available to all users (FREE and PLUS).
