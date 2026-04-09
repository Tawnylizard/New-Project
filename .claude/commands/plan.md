---
description: Create an implementation plan and save it to docs/plans/. Lightweight planning
  for tasks that don't need full SPARC lifecycle. Auto-committed on session end.
  $ARGUMENTS: task or feature name to plan
---

# /plan $ARGUMENTS

## Purpose

Lightweight implementation planning. Creates a structured plan file in `docs/plans/`
that is auto-committed on session end (Stop hook).

Use this for:
- Simple tasks (< 1 day, < 10 files)
- Refactoring or bug fixes
- Quick feature additions

For complex features → use `/feature` (full SPARC lifecycle).
For automated selection → use `/go`.

## Process

### Step 1: Understand the Task

Read relevant docs:
- `docs/Architecture.md` — check component structure
- `docs/Pseudocode.md` — check if algorithms exist
- Existing code if modifying something

### Step 2: Create Plan File

Save to `docs/plans/<kebab-case-name>.md`:

```markdown
# Plan: <Task Name>

**Created:** YYYY-MM-DD
**Scope:** <package(s) affected>
**Estimated effort:** <time estimate>

## Goal

[One sentence: what does this accomplish?]

## Context

[Why are we doing this? Reference to feature in roadmap or issue.]

## Tasks

### Phase 1: <description> (sequential)

- [ ] **[Task]**: <what + which file>
  - Source: `docs/...` if applicable
  - Commit: `type(scope): description`

### Phase 2: <description> (parallel ⚡)

- [ ] ⚡ **[Task A]**: <package 1>
  - Files: `...`
  - Commit: `type(scope): description`

- [ ] ⚡ **[Task B]**: <package 2>
  - Files: `...`
  - Commit: `type(scope): description`

## Files to Touch

| File | Action | Package |
|------|--------|---------|
| `apps/api/src/...` | create/modify | api |

## Risks

- [Risk]: [mitigation]

## Definition of Done

- [ ] Tests pass
- [ ] No TypeScript errors
- [ ] Code reviewed (@code-reviewer)
```

### Step 3: Notify

```
📋 Plan saved: docs/plans/<name>.md
🔄 Will be auto-committed on session end
💡 To implement: just start working, or run /go <name>
```

## Notes

- Plans are auto-committed by the Stop hook — no manual commit needed
- If the plan grows complex, consider upgrading to `/feature`
- Use `@planner` agent for help breaking down complex tasks
