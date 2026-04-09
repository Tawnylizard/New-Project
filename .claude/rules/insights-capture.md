# Insights Capture Protocol

## Error-First Lookup (CRITICAL — do this BEFORE debugging)

**IMPORTANT:** When you encounter ANY error, ALWAYS do this before starting to debug:

```bash
# Step 1: Check if index exists
if [ -f "myinsights/1nsights.md" ]; then
  # Step 2: Grep for the error signature in the index
  grep -i "ERROR_STRING_OR_CODE" myinsights/1nsights.md
fi
```

**Pattern:**
1. User reports a problem or an error occurs
2. Extract the key error string (error code, exception name, or unique message fragment)
3. `grep` the error string against `myinsights/1nsights.md` Error Signatures column
4. **If match found** → read ONLY the linked detail file → suggest documented solution FIRST
5. **If match found AND solution works** → increment hit counter in both index and detail file
6. **If no match** → debug normally → after resolution, suggest capturing with `/myinsights`

**Example lookup flow:**
```
Error: ECONNREFUSED 127.0.0.1:5432
→ grep "ECONNREFUSED" myinsights/1nsights.md
→ Match: INS-001 | `ECONNREFUSED`, `port 5432` | Postgres connection... | INS-001-docker-pg-network.md
→ cat myinsights/INS-001-docker-pg-network.md
→ Apply documented solution
→ Increment hit counter
```

## When to Suggest Capturing an Insight

Proactively suggest `/myinsights` when ANY of these occur:

1. **Error → Fix cycle**: A non-trivial bug was debugged and resolved
   - Especially: errors that took >3 attempts to fix
   - Especially: misleading error messages that pointed wrong direction

2. **Configuration surprise**: A config setting behaved unexpectedly
   - Docker networking quirks
   - Environment variable gotchas
   - Telegram Mini App / initData edge cases
   - YandexGPT / GigaChat API behavior

3. **Dependency issue**: A library/package caused problems
   - Version conflicts
   - Undocumented breaking changes
   - Platform-specific behavior (e.g. Fastify 5 breaking changes)

4. **Architecture decision under pressure**: A design choice was made
   during debugging that should be documented

5. **Workaround applied**: A temporary fix was applied that needs
   future attention (suggest status: Workaround)

## How to Suggest

After resolving a tricky issue, say:
```
💡 Это ценный инсайт. Записать?
   Запусти `/myinsights [краткое название]` или скажи "да, запиши"
```

## When NOT to Suggest

- Trivial typos or syntax errors
- Well-known framework patterns already in coding-style.md
- Issues already documented in `myinsights/` (check index first!)
- User explicitly said they don't want to capture

## Lifecycle Awareness

When reviewing insights during lookup, check the status:
- **Active** — trusted solution, apply directly
- **Workaround** — temporary fix, may need better solution. Apply but flag to user.
- **Obsolete** — should be in archive. If found in main folder, suggest `/myinsights archive INS-NNN`

When a workaround gets a proper fix, suggest:
```
💡 INS-NNN was a workaround. Now we have a proper fix — update it?
   Run `/myinsights status INS-NNN active` and I'll update the solution.
```
