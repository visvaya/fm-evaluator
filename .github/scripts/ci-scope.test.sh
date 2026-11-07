#!/usr/bin/env bash
# Sample-list tests for ci-scope.sh. Run: bash .github/scripts/ci-scope.test.sh
set -euo pipefail
script="$(dirname "$0")/ci-scope.sh"
failures=0

check() {
  local label="$1" input="$2" expected="$3" actual
  actual="$(printf '%b' "$input" | bash "$script" | tr '\n' ' ')"
  if [ "$actual" = "$expected" ]; then
    echo "ok   $label"
  else
    echo "FAIL $label: got '$actual', want '$expected'"
    failures=$((failures + 1))
  fi
}

check 'docs only' 'docs/a.md\nREADME.md\n' 'docs_only=true e2e=false security=false '
check 'docs plus code' 'docs/a.md\nsrc/x.ts\n' 'docs_only=false e2e=true security=false '
check 'empty list' '' 'docs_only=false e2e=true security=true '
check 'fixture markdown' 'e2e/fixtures/x.md\n' 'docs_only=false e2e=true security=false '
check 'workflow' '.github/workflows/ci.yml\n' 'docs_only=false e2e=true security=true '
check 'lockfile' 'pnpm-lock.yaml\n' 'docs_only=false e2e=true security=true '
check 'scripts only' 'scripts/check-docs.mjs\n' 'docs_only=false e2e=false security=false '
# A rename lists the new and the previous path (previous_filename from the API).
check 'rename code to docs' 'docs/old-parser.md\nsrc/parser.ts\n' 'docs_only=false e2e=true security=false '

[ "$failures" -eq 0 ]
