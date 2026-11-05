#!/bin/sh
# Records what V2 really sends and receives, so nobody has to retype JSON fixtures by hand.
#
#   v2_contracts.sh --role aparatchi
#   v2_contracts.sh test/worker_list_api_test.dart [more test files...]
#
# It exports the baseline commit to a temp folder, swaps package:http for a copy whose MockClient logs
# every request and response, runs the V2 tests there, and writes tests/contracts/<test name>.json.
# V2 itself is never touched. Flutter writes to its own cache under .tools/, so inside the Codex sandbox
# this one command needs approval to run outside it.
set -eu

here=$(cd "$(dirname "$0")" && pwd)
v4=$(cd "$here/../../../.." && pwd)
root=/Users/wikki/Desktop/Accord_project
v2=${ACCORD_V2:-$root/accord_mobile_v2}
flutter=${ACCORD_FLUTTER:-$root/.tools/flutter-sdk/flutter/bin/flutter}
baseline=$(cat "$v4/docs/port/V2_BASELINE")
pubcache=${PUB_CACHE:-$root/.tools/pub-cache}

if [ "${1:-}" = "--role" ]; then
  [ "$#" -eq 2 ] || { echo "Usage: v2_contracts.sh --role <id>" >&2; exit 2; }
  node "$here/port_ledger.mjs" role "$2" >/dev/null
  role=$2
  set -- $(cat "$v4/.port/role-$role.contract-tests.txt")
  if [ "$#" -eq 0 ]; then
    echo "Role $role has no V2 tests with HTTP mocks, so there is nothing to record."
    exit 0
  fi
  # Roles share V2 tests. A fixture already recorded at this baseline is kept, so parallel sessions do not
  # rewrite the same file. Naming a test file explicitly still records it again.
  missing=""
  for file in "$@"; do
    existing="$v4/tests/contracts/$(basename "$file" .dart).json"
    if [ -f "$existing" ] && grep -q "\"baseline\": \"$baseline\"" "$existing"; then continue; fi
    missing="$missing $file"
  done
  set -- $missing
  if [ "$#" -eq 0 ]; then
    echo "Every V2 test of role $role is already recorded at this baseline."
    exit 0
  fi
fi
if [ "$#" -eq 0 ]; then
  echo "Usage: v2_contracts.sh --role <id> | <test file>..." >&2
  exit 2
fi

work=$(mktemp -d "${TMPDIR:-/tmp}/accord-v2-contracts.XXXXXX")
trap 'rm -rf "$work"' EXIT
git --no-optional-locks -C "$v2" archive "$baseline" lib test pubspec.yaml pubspec.lock analysis_options.yaml assets third_party \
  | tar -x -C "$work"

version=$(awk '/^  http:/{found=1} found&&/version:/{gsub(/"/,"",$2); print $2; exit}' "$work/pubspec.lock")
cp -R "$pubcache/hosted/pub.dev/http-$version" "$work/third_party/http_recording"
chmod -R u+w "$work/third_party/http_recording"
node "$here/v2_contracts_patch.mjs" "$work/third_party/http_recording/lib/src/mock_client.dart" "$work/pubspec.yaml"

mkdir -p "$work/.contracts"
cd "$work"
export CI=true FLUTTER_SUPPRESS_ANALYTICS=true PUB_CACHE="$pubcache" ACCORD_CONTRACT_OUT="$work/.contracts"
"$flutter" pub get --offline >/dev/null
"$flutter" test --reporter expanded "$@" 2>&1 | tail -1 | cut -c1-160
node "$here/v2_contracts_patch.mjs" --collect "$work/.contracts" "$v4/tests/contracts" "$baseline"
