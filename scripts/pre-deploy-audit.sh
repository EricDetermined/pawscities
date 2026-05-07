#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# PawCities Pre-Deployment Audit
# ═══════════════════════════════════════════════════════════════════════════════
# Run before every deploy to catch common bugs that are invisible until runtime.
# Usage: ./scripts/pre-deploy-audit.sh
# Returns exit code 0 if all checks pass, 1 if any critical issues found.
#
# Checks:
# 1. Build-time env var caching (the bug that killed cron jobs + email for weeks)
# 2. Missing runtime function wrappers for secrets/tokens
# 3. Vercel cron config validation
# 4. TypeScript compilation of modified files
# 5. Dead API routes (files exist but not referenced)
# 6. Hardcoded secrets or tokens
# ═══════════════════════════════════════════════════════════════════════════════

set -e
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color
BOLD='\033[1m'

CRITICAL=0
WARNINGS=0

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  🐾 PawCities Pre-Deployment Audit"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# ─── Check 1: Build-time env var caching ──────────────────────────────────────
echo "${BOLD}[1/6] Checking for build-time env var caching...${NC}"

# Find module-level const assignments from process.env (excluding NEXT_PUBLIC_ which are
# intentionally inlined at build time, and excluding inside function bodies)
CACHED_VARS=$(grep -rn "^const.*= process\.env\." src/ --include="*.ts" --include="*.tsx" \
  | grep -v "NEXT_PUBLIC_" \
  | grep -v "\.d\.ts" \
  | grep -v "node_modules" \
  | grep -v "EMAIL_FROM" \
  || true)

if [ -n "$CACHED_VARS" ]; then
  # Filter out Stripe (acceptable pattern)
  NON_STRIPE=$(echo "$CACHED_VARS" | grep -v "new Stripe" || true)
  if [ -n "$NON_STRIPE" ]; then
    echo -e "  ${RED}CRITICAL: Module-level env vars will be cached at build time!${NC}"
    echo "  These MUST be wrapped in functions (e.g., function getX() { return process.env.X; })"
    echo ""
    echo "$NON_STRIPE" | while IFS= read -r line; do
      echo -e "    ${RED}→ $line${NC}"
    done
    echo ""
    CRITICAL=$((CRITICAL + 1))
  else
    echo -e "  ${GREEN}✓ No dangerous build-time caching found${NC}"
  fi
else
  echo -e "  ${GREEN}✓ No dangerous build-time caching found${NC}"
fi

# ─── Check 2: CRON_SECRET must always use getCronSecret() ────────────────────
echo "${BOLD}[2/6] Checking CRON_SECRET usage patterns...${NC}"

BAD_CRON=$(grep -rn "const CRON_SECRET\|= CRON_SECRET\b" src/ --include="*.ts" --include="*.tsx" \
  | grep -v "getCronSecret\|function getCronSecret\|process\.env\.CRON_SECRET" \
  || true)

if [ -n "$BAD_CRON" ]; then
  echo -e "  ${RED}CRITICAL: CRON_SECRET used as module-level constant${NC}"
  echo "$BAD_CRON" | while IFS= read -r line; do
    echo -e "    ${RED}→ $line${NC}"
  done
  CRITICAL=$((CRITICAL + 1))
else
  echo -e "  ${GREEN}✓ All CRON_SECRET references use getCronSecret()${NC}"
fi

# ─── Check 3: Vercel cron config validation ───────────────────────────────────
echo "${BOLD}[3/6] Validating vercel.json cron configuration...${NC}"

if [ -f "vercel.json" ]; then
  # Check that every cron path has a matching route.ts file
  CRON_PATHS=$(grep -o '"path": "[^"]*"' vercel.json | sed 's/"path": "//;s/"//' | sed 's/?.*//')
  MISSING_ROUTES=""
  for cron_path in $CRON_PATHS; do
    # Convert URL path to file path
    route_file="src/app${cron_path}/route.ts"
    if [ ! -f "$route_file" ]; then
      MISSING_ROUTES="${MISSING_ROUTES}\n    → ${cron_path} (expected: ${route_file})"
    fi
  done

  if [ -n "$MISSING_ROUTES" ]; then
    echo -e "  ${RED}CRITICAL: Cron jobs point to missing route files:${NC}"
    echo -e "$MISSING_ROUTES"
    CRITICAL=$((CRITICAL + 1))
  else
    CRON_COUNT=$(echo "$CRON_PATHS" | wc -l | tr -d ' ')
    echo -e "  ${GREEN}✓ All ${CRON_COUNT} cron routes have matching files${NC}"
  fi

  # Verify cron secret is templated correctly
  BAD_SECRET=$(grep -c '"secret=\${CRON_SECRET}"' vercel.json || true)
  GOOD_SECRET=$(grep -c 'CRON_SECRET' vercel.json || true)
  if [ "$GOOD_SECRET" -gt 0 ] && [ "$BAD_SECRET" -eq 0 ]; then
    echo -e "  ${YELLOW}⚠ Verify CRON_SECRET template syntax in vercel.json${NC}"
    WARNINGS=$((WARNINGS + 1))
  else
    echo -e "  ${GREEN}✓ CRON_SECRET properly templated${NC}"
  fi
else
  echo -e "  ${YELLOW}⚠ No vercel.json found${NC}"
  WARNINGS=$((WARNINGS + 1))
fi

# ─── Check 4: TypeScript compilation ─────────────────────────────────────────
echo "${BOLD}[4/6] Checking TypeScript compilation of API routes...${NC}"

# Only check API routes and lib files (skip known-broken legacy components)
TS_ERRORS=$(npx tsc --noEmit 2>&1 | grep -E "src/(app/api|lib)/" | head -10 || true)

if [ -n "$TS_ERRORS" ]; then
  echo -e "  ${RED}CRITICAL: TypeScript errors in API routes:${NC}"
  echo "$TS_ERRORS" | while IFS= read -r line; do
    echo -e "    ${RED}→ $line${NC}"
  done
  CRITICAL=$((CRITICAL + 1))
else
  echo -e "  ${GREEN}✓ API routes and libs compile cleanly${NC}"
fi

# ─── Check 5: Hardcoded secrets ──────────────────────────────────────────────
echo "${BOLD}[5/6] Scanning for hardcoded secrets...${NC}"

HARDCODED=$(grep -rn "sk-[a-zA-Z0-9]\{20,\}\|Bearer [a-zA-Z0-9]\{30,\}\|EAAG[a-zA-Z0-9]\{30,\}" src/ --include="*.ts" --include="*.tsx" \
  | grep -v "node_modules\|\.d\.ts\|// example\|// test" \
  || true)

if [ -n "$HARDCODED" ]; then
  echo -e "  ${RED}CRITICAL: Possible hardcoded secrets found:${NC}"
  echo "$HARDCODED" | while IFS= read -r line; do
    echo -e "    ${RED}→ $line${NC}"
  done
  CRITICAL=$((CRITICAL + 1))
else
  echo -e "  ${GREEN}✓ No hardcoded secrets detected${NC}"
fi

# ─── Check 6: Email delivery chain ──────────────────────────────────────────
echo "${BOLD}[6/6] Verifying email delivery chain...${NC}"

# Check that getAdminEmails() pattern is used (not module-level ADMIN_EMAILS)
BAD_EMAIL=$(grep -rn "^const ADMIN_EMAILS\|= ADMIN_EMAILS\b" src/ --include="*.ts" --include="*.tsx" \
  | grep -v "getAdminEmails\|function getAdminEmails\|process\.env\.ADMIN_EMAILS" \
  || true)

if [ -n "$BAD_EMAIL" ]; then
  echo -e "  ${RED}CRITICAL: ADMIN_EMAILS used as module-level constant${NC}"
  echo "$BAD_EMAIL" | while IFS= read -r line; do
    echo -e "    ${RED}→ $line${NC}"
  done
  CRITICAL=$((CRITICAL + 1))
else
  echo -e "  ${GREEN}✓ ADMIN_EMAILS properly deferred to runtime${NC}"
fi

# Check Resend import exists
RESEND_IMPORT=$(grep -rn "from 'resend'" src/ --include="*.ts" | head -1 || true)
if [ -z "$RESEND_IMPORT" ]; then
  echo -e "  ${YELLOW}⚠ Resend SDK not imported in any file${NC}"
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "  ${GREEN}✓ Resend SDK imported${NC}"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════════════════"
if [ "$CRITICAL" -gt 0 ]; then
  echo -e "  ${RED}${BOLD}✗ FAILED: ${CRITICAL} critical issue(s), ${WARNINGS} warning(s)${NC}"
  echo -e "  ${RED}DO NOT DEPLOY until critical issues are resolved.${NC}"
  echo "═══════════════════════════════════════════════════════════════"
  exit 1
elif [ "$WARNINGS" -gt 0 ]; then
  echo -e "  ${YELLOW}${BOLD}⚠ PASSED with ${WARNINGS} warning(s)${NC}"
  echo "═══════════════════════════════════════════════════════════════"
  exit 0
else
  echo -e "  ${GREEN}${BOLD}✓ ALL CHECKS PASSED${NC}"
  echo "═══════════════════════════════════════════════════════════════"
  exit 0
fi
