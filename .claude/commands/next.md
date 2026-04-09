---
description: Show sprint status and next features to work on. Updates feature roadmap
  when features are completed. Uses feature-navigator skill and feature-roadmap.json.
  $ARGUMENTS: optional — "update" to scan codebase | feature-id to mark done
---

# /next $ARGUMENTS

## Default: Show Sprint Status

```
Read .claude/skills/feature-navigator/SKILL.md
Read .claude/feature-roadmap.json
```

Show current sprint snapshot:
- MVP progress bar
- In-progress features
- Next 3 features (respecting depends_on)
- Blockers
- Top 3 suggested next actions

## `/next update` — Scan & Suggest Status Updates

1. Read `.claude/feature-roadmap.json` — get current statuses
2. Scan codebase for implemented features:
   - Check `apps/api/src/routes/` for route files
   - Check `apps/tma/src/pages/` for page files
   - Check `packages/db/schema.prisma` for models
3. Compare implemented vs roadmap
4. Suggest status updates:
   ```
   Based on codebase scan, suggest updating:
   - telegram-auth: next → in_progress (route file exists)
   - csv-import: planned → next (auth is done)
   ```
5. Ask for confirmation before updating roadmap

## `/next <feature-id>` — Mark Done & Cascade

1. Set feature `<feature-id>` status → `done`
2. Find features with `depends_on` including `<feature-id>`
3. If all their dependencies are now `done` → set to `next`
4. Update `.claude/feature-roadmap.json`
5. Show what was unblocked

Example:
```
/next telegram-auth

✅ telegram-auth → done
🔓 Unblocked: csv-import (was waiting on telegram-auth)
🔓 Unblocked: payments-subscription (was waiting on telegram-auth)

⏭️  Next up:
  1. csv-import (must_have, no deps)
  2. payments-subscription (must_have, no deps)
  3. spending-dashboard (must_have, needs csv-import)
```

## Roadmap File

The roadmap is at `.claude/feature-roadmap.json`.
It is auto-committed by the Stop hook when changed.
