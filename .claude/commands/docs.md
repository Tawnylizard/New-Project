---
description: Generate or update project documentation in Russian and English.
  Creates comprehensive docs covering deployment, usage, architecture, and user flows.
  $ARGUMENTS: optional — "rus" (Russian only), "eng" (English only), "update" (refresh existing)
---

# /docs $ARGUMENTS

## Purpose

Generate professional, bilingual project documentation from source code,
existing docs, and development insights. Output: `README/rus/` and `README/eng/`.

## Step 1: Gather Context

Read all available sources:

**Primary sources:**
- `docs/PRD.md` — product requirements, features
- `docs/Architecture.md` — system architecture, tech stack
- `docs/Specification.md` — API, data model, user stories
- `docs/Completion.md` — deployment, environment setup
- `docs/features/` — feature-specific documentation
- `CLAUDE.md` — project overview, commands, agents
- `DEVELOPMENT_GUIDE.md` — development workflow

**Secondary sources:**
- `myinsights/1nsights.md` — development insights index
- `.claude/feature-roadmap.json` — feature list and statuses

**Tertiary sources:**
- Source code structure — actual implementation
- `package.json` — dependencies, scripts
- `docker-compose.yml` — infrastructure services
- `.env.example` — environment variables

## Step 2: Determine Scope

```
IF $ARGUMENTS contains "rus":  languages = ["rus"]
ELIF $ARGUMENTS contains "eng": languages = ["eng"]
ELSE: languages = ["rus", "eng"]

IF $ARGUMENTS contains "update":
    mode = "update"  — read existing /README/ files, update only changed sections
ELSE:
    mode = "create"  — generate from scratch
```

## Step 3: Generate Documentation Set

For EACH language, generate 7 files:

1. `deployment.md` — как развернуть / Deployment Guide
2. `admin-guide.md` — руководство администратора / Admin Guide
3. `user-guide.md` — руководство пользователя / User Guide
4. `infrastructure.md` — требования к инфраструктуре / Infrastructure Requirements
5. `architecture.md` — архитектура системы / System Architecture
6. `ui-guide.md` — интерфейс системы / UI Guide
7. `user-flows.md` — пользовательские сценарии / User & Admin Flows

## Step 4: Generate Output

```bash
mkdir -p README/rus README/eng
```

- Russian files → `README/rus/`
- English files → `README/eng/`
- Bilingual index → `README/index.md`

## Step 5: Commit and Report

```bash
git add README/
git commit -m "docs: generate project documentation (RU/EN)"
git push origin HEAD
```

Report:
```
📚 Documentation generated: README/

🇷🇺 Russian (README/rus/): 7 files
🇬🇧 English (README/eng/): 7 files
📄 README/index.md — documentation index
```

## Notes

- Documentation is generated from ACTUAL project state, not assumptions
- Mermaid diagrams for architecture and flow visualizations
- If UI doesn't exist yet, ui-guide.md describes planned UI
- myinsights/ is checked for gotchas to include in troubleshooting sections
