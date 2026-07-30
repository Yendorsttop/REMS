#!/bin/sh
set -eu

evidence_dir="${1:-}"
if [ -z "$evidence_dir" ] || [ ! -d "$evidence_dir" ]; then
  echo 'usage: verify-staging-evidence.sh <external-evidence-directory>' >&2
  exit 2
fi

required='deployment-revision migration-result role-ownership health oidc backup-restoration vulnerability-scan rollback-test founder-review'
for artifact in $required; do
  file="$evidence_dir/$artifact.md"
  test -s "$file" || { echo "missing required evidence: $artifact" >&2; exit 1; }
  grep -Eq '^Evidence status: VERIFIED$' "$file" || {
    echo "unverified required evidence: $artifact" >&2
    exit 1
  }
  grep -Eq '^Recorded at \(UTC\): [0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$' "$file" || {
    echo "invalid evidence timestamp: $artifact" >&2
    exit 1
  }
  grep -Eq '^Reviewed by: .+' "$file" || { echo "missing reviewer: $artifact" >&2; exit 1; }
  if grep -Eqi 'NOT_RECORDED|TODO|TEMPLATE_VALUE|PENDING' "$file"; then
    echo "placeholder remains in evidence: $artifact" >&2
    exit 1
  fi
done
echo 'staging evidence gate passed'
