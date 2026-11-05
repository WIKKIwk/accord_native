#!/bin/sh
# Runs V2 tests without touching V2. The baseline commit is exported to a temp folder and Flutter runs there.
#
#   v2_oracle.sh test/worker_list_api_test.dart [more test files...]
#
# To dump golden values from pure Dart logic, put a temporary *_test.dart in a folder and set
# ORACLE_EXTRA=<folder>. Those files are copied into the export and never reach V2.
# KEEP=1 keeps the export and prints its path.
set -eu

here=$(cd "$(dirname "$0")" && pwd)
v4=$(cd "$here/../../../.." && pwd)
root=/Users/wikki/Desktop/Accord_project
v2=${ACCORD_V2:-$root/accord_mobile_v2}
flutter=${ACCORD_FLUTTER:-$root/.tools/flutter-sdk/flutter/bin/flutter}
baseline=$(cat "$v4/docs/port/V2_BASELINE")

if [ "$#" -eq 0 ]; then
  echo "Usage: v2_oracle.sh <test file> [more test files...]" >&2
  exit 2
fi

work=$(mktemp -d "${TMPDIR:-/tmp}/accord-v2-oracle.XXXXXX")
if [ "${KEEP:-}" != "1" ]; then
  trap 'rm -rf "$work"' EXIT
fi

git --no-optional-locks -C "$v2" archive "$baseline" lib test pubspec.yaml pubspec.lock analysis_options.yaml assets third_party \
  | tar -x -C "$work"

if [ -n "${ORACLE_EXTRA:-}" ]; then
  cp "$ORACLE_EXTRA"/*.dart "$work/test/"
fi

cd "$work"
export CI=true FLUTTER_SUPPRESS_ANALYTICS=true PUB_CACHE="${PUB_CACHE:-$root/.tools/pub-cache}"
"$flutter" pub get --offline >/dev/null
"$flutter" test "$@"

if [ "${KEEP:-}" = "1" ]; then
  echo "Export kept at: $work"
fi
