#!/bin/bash

# Verify GDPR & Security Implementation Script
# Run this to verify all components are properly installed

set -e

echo "=================================================="
echo "PawsCities GDPR & Security Implementation Verify"
echo "=================================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

check_file() {
  if [ -f "$1" ]; then
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
  else
    echo -e "${RED}✗${NC} $1 (MISSING)"
    ((FAILED++))
  fi
}

check_dir() {
  if [ -d "$1" ]; then
    echo -e "${GREEN}✓${NC} $1/"
    ((PASSED++))
  else
    echo -e "${RED}✗${NC} $1/ (MISSING)"
    ((FAILED++))
  fi
}

check_env() {
  if grep -q "$1" .env.local 2>/dev/null; then
    echo -e "${GREEN}✓${NC} $1 in .env.local"
    ((PASSED++))
  else
    echo -e "${YELLOW}⚠${NC} $1 not found in .env.local"
    ((WARNINGS++))
  fi
}

# Check files
echo "1. Checking GDPR & Security Files..."
echo "-----------------------------------"
check_file "src/lib/gdpr.ts"
check_file "src/lib/security.ts"
check_file "src/lib/security-config.ts"

echo ""
echo "2. Checking API Endpoints..."
echo "----------------------------"
check_file "src/app/api/webhooks/supabase-auth/route.ts"
check_file "src/app/api/gdpr/export/route.ts"
check_file "src/app/api/gdpr/delete/route.ts"
check_file "src/app/api/gdpr/consent/route.ts"
check_file "src/app/api/gdpr/audit-trail/route.ts"
check_file "src/app/api/auth/login-event/route.ts"

echo ""
echo "3. Checking Components..."
echo "------------------------"
check_file "src/components/auth/AuthProvider.tsx"
check_file "src/components/layout/CookieConsent.tsx"
check_file "src/app/profile/privacy/page.tsx"

echo ""
echo "4. Checking Documentation..."
echo "----------------------------"
check_file "docs/GDPR_AND_SECURITY.md"
check_file "SECURITY_SETUP.md"
check_file "IMPLEMENTATION_SUMMARY.md"
check_file "QUICK_START.md"

echo ""
echo "5. Checking Database Schema..."
echo "------------------------------"
if grep -q "DataProcessingLog" prisma/schema.prisma; then
  echo -e "${GREEN}✓${NC} DataProcessingLog model in schema"
  ((PASSED++))
else
  echo -e "${RED}✗${NC} DataProcessingLog model not found in schema"
  ((FAILED++))
fi

echo ""
echo "6. Checking Dependencies..."
echo "---------------------------"
if grep -q "@supabase/supabase-js" package.json; then
  echo -e "${GREEN}✓${NC} @supabase/supabase-js installed"
  ((PASSED++))
else
  echo -e "${RED}✗${NC} @supabase/supabase-js not found"
  ((FAILED++))
fi

if grep -q "@prisma/client" package.json; then
  echo -e "${GREEN}✓${NC} @prisma/client installed"
  ((PASSED++))
else
  echo -e "${RED}✗${NC} @prisma/client not found"
  ((FAILED++))
fi

if grep -q "lucide-react" package.json; then
  echo -e "${GREEN}✓${NC} lucide-react installed"
  ((PASSED++))
else
  echo -e "${YELLOW}⚠${NC} lucide-react not found (needed for icons)"
  ((WARNINGS++))
fi

echo ""
echo "7. Checking Environment Variables..."
echo "------------------------------------"
if [ -f .env.local ]; then
  check_env "SUPABASE_WEBHOOK_SECRET"
  check_env "GDPR_DATA_RETENTION_DAYS"
  check_env "GDPR_LOGS_RETENTION_DAYS"
else
  echo -e "${YELLOW}⚠${NC} .env.local file not found"
  ((WARNINGS++))
fi

echo ""
echo "=================================================="
echo "Summary"
echo "=================================================="
echo -e "Passed:  ${GREEN}$PASSED${NC}"
echo -e "Failed:  ${RED}$FAILED${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All core files are in place!${NC}"
  echo ""
  echo "Next steps:"
  echo "1. npx prisma migrate dev --name add_data_processing_log"
  echo "2. Add SUPABASE_WEBHOOK_SECRET to .env.local"
  echo "3. Configure webhook in Supabase dashboard"
  echo "4. npm run dev"
  echo ""
  exit 0
else
  echo -e "${RED}✗ Some files are missing!${NC}"
  echo ""
  echo "Please ensure all files are created correctly."
  echo "Refer to IMPLEMENTATION_SUMMARY.md for details."
  echo ""
  exit 1
fi
