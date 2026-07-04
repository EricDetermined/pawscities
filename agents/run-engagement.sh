#!/bin/bash
# ─────────────────────────────────────────────────────────────
# PawCities Daily Engagement Bot Launcher
#
# Launch this each morning. It will:
#   1. (Monday) Scrape posts from 188 followed accounts
#   2. Discover fresh posts across all 8 cities (Apify ~$0.50)
#   3. Generate contextual comments for each post
#   4. Execute comments with human-like timing and likes mixed in
#   5. Monitor replies to past comments
#   6. Generate & send re-engagement replies
#   7. Print stats when done
#
# IMPORTANT: Follow-back is now a SEPARATE session (run on different days).
# Running comments + follows in the same session is a bot detection signal.
#
# Your Mac won't sleep while this runs (caffeinate).
# Switching to another macOS user account is fine — it keeps going.
#
# Usage:
#   ./agents/run-engagement.sh           # Full pipeline, 15 comments (safe cap)
#   ./agents/run-engagement.sh 10        # Full pipeline, 10 comments
#   ./agents/run-engagement.sh replies   # Only reply monitoring + re-engagement
#   ./agents/run-engagement.sh follows   # Only follow-back (run separately!)
# ─────────────────────────────────────────────────────────────

set -e

# Navigate to project root (parent of agents/)
cd "$(dirname "$0")/.."

# ─── Environment ────────────────────────────────────────────
if [ -f .env.engagement ]; then
  export $(grep -v '^#' .env.engagement | xargs)
fi

# Check required vars
if [ -z "$IG_USERNAME" ] || [ -z "$IG_PASSWORD" ] || [ -z "$APIFY_TOKEN" ]; then
  echo "❌ Missing environment variables."
  echo ""
  echo "Create a file called .env.engagement in the pawscities folder with:"
  echo ""
  echo "  IG_USERNAME=thepawcities"
  echo "  IG_PASSWORD=your_password_here"
  echo "  APIFY_TOKEN=your_apify_token_here"
  echo ""
  echo "Or export them in your ~/.zshrc"
  exit 1
fi

# ─── Config ─────────────────────────────────────────────────
LOG_DIR="./data/engagement"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/run-$(date +%Y-%m-%d).log"

# Parse args: supports these combos:
#   ./run-engagement.sh              → full pipeline, 50 comments
#   ./run-engagement.sh 25           → full pipeline, 25 comments
#   ./run-engagement.sh run          → run-only (post queued comments), 50 comments
#   ./run-engagement.sh 25 run       → run-only, 25 comments
#   ./run-engagement.sh run 25       → run-only, 25 comments
#   ./run-engagement.sh replies      → reply monitoring only
MODE="full"
LIMIT=15

for arg in "$@"; do
  if [[ "$arg" =~ ^[0-9]+$ ]]; then
    LIMIT="$arg"
  elif [ "$arg" = "run" ]; then
    MODE="run"
  elif [ "$arg" = "replies" ]; then
    MODE="replies"
  elif [ "$arg" = "follows" ]; then
    MODE="follows"
  elif [ "$arg" = "full" ]; then
    MODE="full"
  fi
done

echo "🐾 PawCities Engagement Bot — $(date '+%A %B %d, %Y %I:%M %p')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Mode: $MODE | Daily limit: $LIMIT comments"
echo "Log file: $LOG_FILE"
echo ""

# ─── Run with caffeinate (prevents Mac sleep) ───────────────
caffeinate -i bash -c "
  # ════════════════════════════════════════════════════════════
  # PHASE 1: OUTBOUND (discover + comment on new posts)
  # ════════════════════════════════════════════════════════════

  if [ '$MODE' = 'full' ] || [ '$MODE' = 'run' ]; then

    if [ '$MODE' = 'full' ]; then
      # Monday bonus: scrape followed accounts
      if [ \"\$(date +%u)\" = \"1\" ]; then
        echo '👥 Monday: Scraping posts from followed accounts...'
        python3 agents/engagement-bot.py discover-following 2>&1 | tee -a '$LOG_FILE'
        echo ''
      fi

      echo '📡 Step 1: Discovering fresh posts...'
      python3 agents/engagement-bot.py discover 2>&1 | tee -a '$LOG_FILE'
      echo ''

      echo '✍️  Step 2: Generating comments...'
      python3 agents/engagement-bot.py generate 2>&1 | tee -a '$LOG_FILE'
      echo ''
    else
      echo '⏩ Skipping discovery & generation — posting queued comments only'
      echo ''
    fi

    echo '🚀 Executing comments (this takes ~60-90 min)...'
    python3 agents/engagement-bot.py run --limit $LIMIT 2>&1 | tee -a '$LOG_FILE'
    echo ''
  fi

  # ════════════════════════════════════════════════════════════
  # PHASE 2: INBOUND (monitor replies + re-engage + follow)
  # ════════════════════════════════════════════════════════════

  if [ '$MODE' = 'full' ] || [ '$MODE' = 'replies' ]; then
    echo '🔔 Monitoring replies to our comments...'
    python3 agents/engagement-bot.py monitor-replies 2>&1 | tee -a '$LOG_FILE'
    echo ''

    echo '🔄 Generating re-engagement replies...'
    python3 agents/engagement-bot.py generate-replies 2>&1 | tee -a '$LOG_FILE'
    echo ''

    echo '💬 Sending re-engagement replies...'
    python3 agents/engagement-bot.py reply --limit 10 2>&1 | tee -a '$LOG_FILE'
    echo ''
  fi

  # ════════════════════════════════════════════════════════════
  # PHASE 2.5: FOLLOW-BACK (separate session — run on different days)
  # Combining comments + follows in the same session is a bot signal.
  # ════════════════════════════════════════════════════════════

  if [ '$MODE' = 'follows' ]; then
    echo '👥 Following back engaged accounts (separate session)...'
    python3 agents/engagement-bot.py follow-back --limit 5 2>&1 | tee -a '$LOG_FILE'
    echo ''

    echo '🤝 Following back new followers...'
    python3 agents/engagement-bot.py follow-all-followers --limit 10 2>&1 | tee -a '$LOG_FILE'
    echo ''
  fi

  # ════════════════════════════════════════════════════════════
  # PHASE 3: REPORT
  # ════════════════════════════════════════════════════════════

  echo '📊 Step 8: Daily stats'
  python3 agents/engagement-bot.py stats 2>&1 | tee -a '$LOG_FILE'
  echo ''

  echo \"✅ Done! \$(date '+%I:%M %p') — Mac can sleep now.\"
" 2>&1

echo ""
echo "Full log saved to: $LOG_FILE"
