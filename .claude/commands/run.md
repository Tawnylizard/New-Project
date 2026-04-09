---
description: Autonomous project build loop. Bootstraps project and implements features
  one by one until MVP (default) or all features are done.
  $ARGUMENTS: "mvp" (default) | "all"
---

# /run $ARGUMENTS

## Purpose

End-to-end autonomous project build: bootstrap → implement features in loop → done.
Combines `/start`, `/next`, and `/go` into a single continuous pipeline.

> **AUTONOMOUS EXECUTION — BLOCKING RULES:**
> - MUST execute features ONE AT A TIME through the full /go pipeline
> - NEVER batch features into parallel waves without individual plans
> - NEVER skip the /next -> /go pipeline by launching raw implementation agents
> - If a feature fails 3 times, skip it and log — NEVER retry indefinitely
> - MUST push state after each feature completion (independent commits)

## Step 0: Parse Scope

```
IF $ARGUMENTS is empty OR $ARGUMENTS == "mvp":
    scope = "mvp"
    → Implement only features with status `next` or `in_progress`
    → Stop when no more `next` features remain (skip `planned`)

IF $ARGUMENTS == "all":
    scope = "all"
    → Implement ALL features regardless of status
    → Stop only when every feature is `done`
```

## Step 1: Bootstrap Project

1. Check if project is already bootstrapped:
   - IF `docker-compose.yml` exists AND `apps/api/src/` exists → skip to Step 2
   - ELSE → run `/start`
2. Verify bootstrap succeeded (docker compose up + health check)
3. Commit and push: `git push origin HEAD`

## Step 2: Feature Implementation Loop

```
LOOP:
    1. Run `/next` to get current sprint status and next feature

    2. IF scope == "mvp":
         - Get next feature with status `next` or `in_progress`
         - IF no such feature exists → EXIT LOOP (MVP complete)
       IF scope == "all":
         - Get next feature that is NOT `done`
         - IF all features are `done` → EXIT LOOP (all complete)

    3. Run `/go <feature-name>` to implement the feature
       - /go automatically selects /plan or /feature
       - /go handles commits and pushes

    4. Verify implementation:
       - Run /test — ensure no regressions
       - IF tests fail → fix before continuing

    5. Update progress:
       - Feature marked as `done` in roadmap (handled by /go)
       - Log progress to stdout

    6. CONTINUE LOOP
```

## Step 3: Finalize

After loop completes:

1. Run full test suite: `npm test --workspaces`
2. Update README.md with current state
3. Final commit: `git add -A && git commit -m "milestone: <scope> complete"`
4. Push and tag:
   ```bash
   git push origin HEAD
   IF scope == "mvp":
       git tag v0.1.0-mvp && git push origin v0.1.0-mvp
   IF scope == "all":
       git tag v1.0.0 && git push origin v1.0.0
   ```
5. Summary report:
```
🏁 /run <scope> — COMPLETE

📊 Summary:
   Features implemented: <count>/<total>
   Total commits: <count>
   Total files: <count>
   Test results: <passed>/<total>

📋 Features completed:
   ✅ telegram-auth  (via /plan)
   ✅ csv-import     (via /feature)
   ✅ roast-mode     (via /feature)
   ...

🏷️ Tagged: v0.1.0-mvp
```

## Error Recovery

- Each feature committed independently → partial progress saved
- If a feature fails repeatedly (3 attempts), skip → mark as `blocked`
- If `/start` fails, stop and report — bootstrap is critical
- On any failure: always push current state to remote first
