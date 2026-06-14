#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/Users/nuevousuario/Library/CloudStorage/GoogleDrive-ivelasquezfr@gmail.com/My Drive/One Drive/Obsidian/Claude Code Setup/Claude Code/02_Programs/1-Workspaces/GPT Chain/_initiatives-software/gumroad-published"
BRANCH="${PUBLISHER_COMMIT_BRANCH:-main}"

cd "$REPO_DIR"

REPORT_PATH="$(node scripts/generate-publisher-daily-report.mjs)"

git add "$REPORT_PATH" \
  scripts/generate-publisher-daily-report.mjs \
  scripts/daily-publisher-commit.sh \
  .github/publisher-daily-commit.md \
  package.json

if git diff --cached --quiet; then
  echo "[publisher-daily-commit] No report changes to commit."
  exit 0
fi

git commit -m "chore(publisher): daily operations report $(basename "$REPORT_PATH" .md)"
git push origin "$BRANCH"

