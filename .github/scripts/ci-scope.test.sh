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
# Files outside src/ that still change what the browser runs.
check 'stylesheet' 'styles.css\n' 'docs_only=false e2e=true security=false '
check 'embedded data' 'embedded-data.js\n' 'docs_only=false e2e=true security=false '
check 'shared vite config' 'vite.shared.ts\n' 'docs_only=false e2e=true security=false '
check 'precache builder' 'scripts/lib/sw-precache.mjs\n' 'docs_only=false e2e=true security=false '
check 'node line' '.nvmrc\n' 'docs_only=false e2e=true security=false '
check 'unknown new file' 'some-new-config.json\n' 'docs_only=false e2e=true security=false '
# Known not to reach the browser.
check 'lint config' '.oxlintrc.json\noxlint-suppressions.json\n' 'docs_only=false e2e=false security=false '
check 'markdown lint config' '.markdownlint-cli2.jsonc\n' 'docs_only=false e2e=false security=false '
check 'goldens' 'goldens/snapshots/a.json\n' 'docs_only=false e2e=false security=false '
check 'other workflow' '.github/workflows/secrets.yml\n' 'docs_only=false e2e=false security=true '
# The Semgrep image pin: a new image runs the SAST step, not the browser.
check 'semgrep image pin' 'docker/semgrep/Dockerfile\n' 'docs_only=false e2e=false security=true '
# hadolint settings run the Dockerfile check, which is part of the security scope.
check 'hadolint settings' '.hadolint.yaml\n' 'docs_only=false e2e=false security=true '
# A Dockerfile anywhere runs hadolint; outside docker/ it may also reach the browser.
check 'dockerfile at the root' 'Dockerfile\n' 'docs_only=false e2e=true security=true '
check 'named containerfile' 'tools/build.Containerfile\n' 'docs_only=false e2e=true security=true '
check 'suffixed dockerfile' 'Dockerfile.prod\n' 'docs_only=false e2e=true security=true '
check 'commit rules' 'commitlint.config.mjs\n.husky/commit-msg\n' 'docs_only=false e2e=false security=false '

[ "$failures" -eq 0 ]
