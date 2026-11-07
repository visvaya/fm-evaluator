#!/usr/bin/env bash
# Decides which parts of the Quality gate a pull request needs.
# Reads changed file paths (one per line) on stdin and prints GITHUB_OUTPUT lines:
#   docs_only  - true when every path is documentation (skip the heavy steps)
#   e2e        - true when a path can change what the browser runs
#   security   - true when workflows, dependencies or lockfiles change
# An empty list counts as code, so every flag is true (safe default).
set -euo pipefail

changed="$(cat)"

# Documentation: docs/ and Markdown anywhere, except Markdown that tooling reads
# as input (fixtures under public/ or e2e/, goldens).
docs_pattern='^docs/|\.md$'
not_docs_pattern='^(public|e2e|goldens|src)/'
e2e_pattern='^(src|e2e|public)/|^index\.html$|^(vite|playwright|vitest)\.config\.|^tsconfig[^/]*\.json$|^security_headers\.json$|^package\.json$|^pnpm-(lock|workspace)\.yaml$|^\.github/workflows/ci\.yml$'
security_pattern='^\.github/|^package\.json$|^pnpm-(lock|workspace)\.yaml$'

if [ -z "$changed" ]; then
  printf 'docs_only=false\ne2e=true\nsecurity=true\n'
  exit 0
fi

code_paths="$(grep -vE "$docs_pattern" <<< "$changed" || true)"
tooling_md="$(grep -E "$docs_pattern" <<< "$changed" | grep -E "$not_docs_pattern" || true)"
if [ -z "$code_paths" ] && [ -z "$tooling_md" ]; then
  echo 'docs_only=true'
else
  echo 'docs_only=false'
fi

if grep -qE "$e2e_pattern" <<< "$changed"; then echo 'e2e=true'; else echo 'e2e=false'; fi
if grep -qE "$security_pattern" <<< "$changed"; then echo 'security=true'; else echo 'security=false'; fi
