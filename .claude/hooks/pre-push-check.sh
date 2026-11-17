#!/usr/bin/env bash
# PreToolUse hook (Bash): before any `git push`, run the merchant console's
# tests and build. Exit 2 blocks the push and shows stderr to Claude.
set -uo pipefail

input=$(cat)
cmd=$(jq -r '.tool_input.command // empty' <<<"$input")
cwd=$(jq -r '.cwd // empty' <<<"$input")

# Only `git push` (also `git -C dir push`, and after `&&` / `;` / `|`).
if ! grep -Eq '(^|[;&|(]|[[:space:]])git([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+push([[:space:]]|$)' <<<"$cmd"; then
  exit 0
fi

root=$(git -C "${cwd:-${CLAUDE_PROJECT_DIR:-.}}" rev-parse --show-toplevel 2>/dev/null || echo "${CLAUDE_PROJECT_DIR:-.}")
app="$root/build-battle/merchant-console"
logs="${TMPDIR:-/tmp}/northwind-pre-push"
mkdir -p "$logs"

if [[ ! -d "$app/node_modules" ]]; then
  echo "Push blocked: no node_modules in $app, so tests and build cannot run. Run: npm ci --prefix \"$app\"" >&2
  exit 2
fi

failed=()
(cd "$app" && npm test) >"$logs/test.log" 2>&1 || failed+=("tests")
(cd "$app" && NEXT_DIST_DIR=.next-prepush npm run build) >"$logs/build.log" 2>&1 || failed+=("build")

if (( ${#failed[@]} )); then
  {
    echo "Push blocked: ${failed[*]} failed."
    for f in "${failed[@]}"; do
      log="$logs/$([[ $f == tests ]] && echo test || echo build).log"
      echo "- $f: see the output with: cat \"$log\""
      echo "  last lines:"
      tail -n 8 "$log" | sed 's/^/    /'
    done
    echo "Fix the failure, then push again."
  } >&2
  exit 2
fi

echo "Pre-push check passed: tests and build OK."
exit 0
