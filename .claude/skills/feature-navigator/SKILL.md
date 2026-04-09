---
name: feature-navigator
description: >
  Feature roadmap navigation for Клёво. Reads feature-roadmap.json and presents
  sprint progress, current work, next priorities, and blockers. Updates feature
  statuses when work completes and cascades dependency unblocking. Use with /next
  command. Triggers on "next feature", "what to work on", "sprint status", "roadmap".
version: "1.0"
maturity: production
---

# Feature Navigator — Клёво

## What I Do

Read `.claude/feature-roadmap.json`, analyze git log and TODO scan, then:
1. Present current sprint status
2. Identify next highest-priority feature
3. Suggest top 3 actionable tasks
4. Update statuses when features complete

## Priority Rules

```
in_progress > next > planned
blocked — skip (show why blocked)
done — skip

Among same status: higher MoSCoW priority first
  must_have > should_have > could_have > wont_have

Among same priority: lower depends_on count first (unblocked)
```

## Session Start Output

```
🚀 Клёво — Sprint Status

✅ Done (N features)
🔄 In Progress: <feature-name> (N days)
⏭️  Next: <feature-name>

📊 MVP Progress: X/Y features

💡 Suggested next actions:
  1. Continue <in-progress feature>: <specific next step>
  2. Start <next feature>: <kickoff task>
  3. <alternative action>
```

## Roadmap Update Logic

When a feature is completed:
1. Set status → `done`
2. Scan other features for `depends_on` that included this feature
3. If all dependencies of a `blocked` feature are now `done` → set to `next`
4. Commit: `docs(roadmap): mark <feature> as done, unblock <dependents>`

## `/next` Command Support

- `/next` — show sprint status + top 3 next tasks
- `/next update` — scan codebase, suggest status updates based on what's actually implemented
- `/next <feature-id>` — mark done, cascade unblocking, show what's next

## Feature Status Values

| Status | Meaning |
|--------|---------|
| `done` | Fully implemented and reviewed |
| `in_progress` | Currently being worked on (max 2 at once) |
| `next` | Ready to start, no blockers |
| `planned` | Scheduled but lower priority |
| `blocked` | Waiting on `depends_on` features |
