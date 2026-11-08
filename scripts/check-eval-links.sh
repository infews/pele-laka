#!/usr/bin/env bash
# Checks the links between evals and their tests.
#
#   check-eval-links.sh [PROJECT_ROOT]
#
# Fails if an eval in docs/evals/ has no test tagged with its @spec ID (a
# production-only monitor may have a "Monitor:" line instead), or if a @spec
# tag anywhere in the project names an eval that doesn't exist.
set -euo pipefail

root="${1:-.}"
evals_dir="$root/docs/evals"
id='[A-Z][A-Z0-9]*-(INV|CON|E2E|MON)-[0-9]{3}[a-z]?'

if [ ! -d "$evals_dir" ]; then
  echo "check-eval-links: no docs/evals/ directory in $root" >&2
  exit 2
fi

# Evals: list items that start with a backticked ID.
defined=$(grep -rhE "^[[:space:]]*- \`$id\`" "$evals_dir" | grep -oE "$id" | sort -u || true)

# Monitors that point at their configuration instead of a test: an eval line
# followed by an indented "Monitor:" line.
monitored_ids=$(find "$evals_dir" -name '*.md' -exec awk '
  /^[[:space:]]*- `[A-Z]/ { split($0, part, "`"); current = part[2]; next }
  /Monitor:/ && current != "" { print current; next }
  /^[^[:space:]]/ { current = "" }
' {} + | grep -E "^$id$" | sort -u || true)

# @spec tags anywhere outside docs/ and dependency folders.
tagged=$(grep -rhoE "@spec[[:space:]]+$id" "$root" \
  --exclude-dir=.git --exclude-dir=docs --exclude-dir=node_modules --exclude-dir=vendor \
  --exclude-dir=tmp --exclude-dir=.bundle 2>/dev/null | grep -oE "$id" | sort -u || true)

covered=$(printf '%s\n%s\n' "$tagged" "$monitored_ids" | grep -v '^$' | sort -u || true)
untested=$(comm -23 <(echo "$defined" | grep -v '^$') <(echo "$covered") || true)
dangling=$(comm -13 <(echo "$defined" | grep -v '^$') <(echo "$tagged" | grep -v '^$') || true)

status=0
if [ -n "$untested" ]; then
  echo "Evals with no @spec test (or Monitor: line):"
  echo "$untested" | sed 's/^/  /'
  status=1
fi
if [ -n "$dangling" ]; then
  echo "@spec tags naming evals that don't exist:"
  echo "$dangling" | sed 's/^/  /'
  status=1
fi
[ $status -eq 0 ] && echo "Eval links OK: $(echo "$defined" | grep -c . || true) evals, all linked."
exit $status
