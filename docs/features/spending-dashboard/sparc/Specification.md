# Specification: Dashboard анализа трат

## User Stories

### US-1: Period Selection
```
As a user,
I want to switch between "This month", "Last month", and "3 months",
So that I can analyze my spending for different time periods.

Acceptance Criteria:
Given I am on the Dashboard
When I tap a period button
Then the chart and category list update within 500ms
And the selected period is visually highlighted
```

### US-2: Spending Total with Comparison
```
As a user,
I want to see my total spending for the selected period
And how it compares to the previous period,
So that I know if I'm spending more or less.

Acceptance Criteria:
Given I have transactions in the current and previous period
When I view the dashboard
Then I see the total amount in rubles
And I see "+X%" or "-X%" compared to the previous period
And the delta is green (↓ less) or red (↑ more)
```

### US-3: Category Breakdown
```
As a user,
I want to see top-5 spending categories with amounts and percentages,
So that I understand where my money goes.

Acceptance Criteria:
Given I have transactions in the selected period
When I view the dashboard
Then I see a pie chart with up to 6 categories
And a list of top-5 categories with emoji, name, amount, and percentage
And categories are sorted by amount descending
```

### US-4: Empty State
```
As a user who has no transactions,
I want to see a clear call-to-action to import CSV,
So that I know how to get started.

Acceptance Criteria:
Given I have no transactions
When I view the dashboard
Then I see an empty state with "Load CSV" button
```

## API Specification

### GET /analytics/summary

**Query params:**
- `period`: `"month"` | `"last_month"` | `"3months"` (default: `"month"`)

**Response (200):**
```json
{
  "period": {
    "from": "2026-03-01T00:00:00.000Z",
    "to": "2026-03-31T23:59:59.999Z"
  },
  "totalKopecks": 124700,
  "previousTotalKopecks": 98300,
  "changePercent": 26.9,
  "topCategories": [
    {
      "category": "FOOD_CAFE",
      "totalKopecks": 45200,
      "percentage": 36.2,
      "transactionCount": 12
    }
  ],
  "transactionCount": 47
}
```

**Auth:** Bearer JWT required

**Cache:** Redis 5 min, key: `analytics:${userId}:${period}`

## Feature Matrix

| Feature | MVP | v1.0 |
|---------|-----|------|
| Period selector (3 options) | ✅ | |
| Total + comparison % | ✅ | |
| Top-5 categories list | ✅ | |
| Pie chart | ✅ | |
| Custom date range | | ✅ |
| Export to PDF | | ✅ |
| Category drill-down | | ✅ |
