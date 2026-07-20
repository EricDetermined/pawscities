# Paw Cities — Operational Guardrails for Agents

> **Last updated:** 2026-06-07
> **Purpose:** Prevent destructive actions on the Paw Cities codebase and infrastructure.
> Every AI agent, human developer, or automation that touches this project **MUST** read and follow these rules.

---

## 1. The Naming Issue: pawcities vs pawscities

There are **TWO** GitHub repositories under the EricDetermined account:

| Repository | URL | Visibility | Purpose |
|---|---|---|---|
| **pawscities** (with 's') | `github.com/EricDetermined/pawscities` | PUBLIC | **PRIMARY — connected to Vercel, serves production** |
| **pawcities** (without 's') | `github.com/EricDetermined/pawcities` | PRIVATE | Mirror/backup only |

### Rules

- **Vercel is connected to `pawscities` (WITH 's').** Never disconnect it and reconnect to the other repo.
- Both repos should be kept in sync. The canonical push target is `pawscities` (with 's').
- When pushing, always push to `pawscities` (with 's') first, then optionally mirror to `pawcities`.
- The Vercel project name in the dashboard is also `pawscities` — this matches the repo name.
- The domain `pawcities.com` (no 's') points to Vercel. Don't let the domain name confuse you — the **repo** has the 's'.

### Git Remote Setup (canonical)

```bash
# Primary remote — ALWAYS push here
git remote set-url origin https://github.com/EricDetermined/pawscities.git

# Optional mirror
git remote add mirror https://github.com/EricDetermined/pawcities.git
```

---

## 2. What Caused the Codebase Overwrite (Incident Report)

### What happened (June 2026)

An AI agent session (likely working on a Prisma migration or restructure) force-pushed a **single-commit** version of the codebase to one of the repos, wiping out the entire 487-commit production history. The agent likely:

1. Created a fresh git repo or squashed all history into one commit
2. Used `git push --force` without checking the existing commit count
3. Did not verify that the remote history matched expectations before force-pushing

### Root cause

- **No branch protection rules** on either GitHub repo
  - *(Fixed 2026-07-20: `protect-main` ruleset now Active on `pawscities` —
    blocks force-pushes and deletion of `main`. If a legitimate history rewrite
    is ever needed, the ruleset must be temporarily disabled in
    Settings → Rules → Rulesets, with explicit user approval.)*
- **No verification step** before force-push operations
- **Agent didn't check commit count** — if it had compared local (1 commit) vs remote (487 commits), the mismatch would have been obvious
- **The naming confusion** (pawcities vs pawscities) meant it wasn't immediately clear which repo was affected

### How we recovered

The `pawscities` (with 's') repo still had the full history intact. We force-pushed from our local copy (which had all 487+ commits) back to both remotes. This session also cleaned up accidentally committed secrets (`.env.engagement` with an Apify token) and added comprehensive `.gitignore` rules.

---

## 3. Force-Push Safety Protocol

**Force-pushing is the most dangerous git operation.** Before ANY force-push:

### Pre-push checklist (MANDATORY)

```bash
# 1. Count local commits
git log --oneline | wc -l

# 2. Count remote commits
git log --oneline origin/main | wc -l

# 3. Compare — if local < remote, STOP and investigate
# A force-push that reduces commit count is almost certainly destructive

# 4. Check what will change
git log origin/main..HEAD --oneline   # New commits being pushed
git log HEAD..origin/main --oneline   # Commits that would be LOST

# 5. If the "LOST" list is non-empty, you are about to destroy work. STOP.
```

### When force-push is acceptable

- Cleaning secrets out of history (as we did with `.env.engagement`)
- Rebasing recent commits (same content, cleaner history)
- Recovering from a previous destructive force-push

### When force-push is NEVER acceptable

- Replacing a multi-commit history with a squashed single commit
- "Starting fresh" with a restructured codebase
- Any time the remote has MORE commits than local

---

## 4. Secret and File Safety

### Files that must NEVER be committed

- `.env.*` files (except `.env.example`)
- Any file containing API keys, tokens, or credentials
- `__pycache__/` directories
- Large binary files (PNGs, DOCXs) — use Supabase Storage instead
- Engagement logs and ephemeral data

### Current .gitignore coverage

The `.gitignore` has been updated (2026-06-07) to catch all known risky file types. If you add a new category of sensitive file, update `.gitignore` BEFORE committing.

### If a secret is accidentally committed

1. **Do NOT just delete the file and commit again** — it's still in git history
2. Remove it from history: `git filter-branch` or `git filter-repo`
3. Or: soft-reset past the bad commit, re-commit without the file, force-push
4. Rotate the exposed credential immediately

---

## 5. Deployment Safety

### Vercel configuration

- **Project:** `pawscities` (Vercel dashboard)
- **Connected repo:** `EricDetermined/pawscities` (WITH 's')
- **Production branch:** `main`
- **Domain:** `pawcities.com`
- **Build time:** ~30 seconds

### Pre-deployment verification

Before pushing to production:

```bash
# 1. Verify TypeScript compiles
npx tsc --noEmit

# 2. Verify the build succeeds locally
npm run build

# 3. Check for accidentally staged sensitive files
git diff --cached --name-only | grep -E '\.(env|key|pem|secret)'
```

### Email configuration for commits

Vercel's "Standard Protection" requires commit emails to match a GitHub account. Use:

```bash
git config user.email "244267086+EricDetermined@users.noreply.github.com"
```

---

## 6. Database Safety (Supabase)

- **Project ID:** `tnqctocershbclhbjnwg`
- **Always test migrations** with `IF NOT EXISTS` / `IF EXISTS` guards
- **Never drop tables** without explicit user confirmation
- **Back up before schema changes** using Supabase dashboard

---

## 7. Agent Behavioral Rules

Every AI agent working on Paw Cities MUST:

1. **Read this file first** when starting a session that involves git, deployment, or infrastructure
2. **Never force-push without the safety checklist** (Section 3)
3. **Always push to `pawscities` (with 's')** as the primary target
4. **Never disconnect Vercel** from `pawscities` without explicit user instruction
5. **Never commit `.env` files** or files containing credentials
6. **Verify build compiles** before pushing
7. **Use the GitHub noreply email** for commits: `244267086+EricDetermined@users.noreply.github.com`
8. **Check remote state before destructive operations** — compare commit counts, review what would be lost
9. **When in doubt, ask** — a 30-second confirmation is better than a destroyed codebase

---

## 8. Quick Reference Card

```
PRODUCTION REPO:  EricDetermined/pawscities  (WITH 's')
BACKUP REPO:      EricDetermined/pawcities   (without 's')
VERCEL PROJECT:   pawscities
DOMAIN:           pawcities.com
SUPABASE:         tnqctocershbclhbjnwg
GIT EMAIL:        244267086+EricDetermined@users.noreply.github.com
COMMIT AUTHOR:    Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```
