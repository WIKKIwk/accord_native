#!/bin/sh
# Creates one isolated working folder for one Codex session.
#
#   port_worktree.sh <name> [base]
#
# <name> is the session, such as base, preparation, preparation-android, build or printer. [base] is the
# branch to start from, main by default.
#
# It creates ../accord_mobile_v4-<name> on branch port/<name>. The folder sits next to the main checkout, so
# ../accord_mobile_v2 still resolves from inside it. node_modules is cloned instead of installed, which is
# fast and takes almost no disk on APFS. Running it again for an existing session only prints the folder.
set -eu

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "Usage: port_worktree.sh <name> [base]" >&2
  exit 2
fi
name=$1
base=${2:-main}
case "$name" in
  "" | *[!a-z0-9-]*)
    echo "Session name must use only a-z, 0-9 and -: $name" >&2
    exit 2
    ;;
esac

here=$(cd "$(dirname "$0")" && pwd)
repo=$(cd "$here/../../../.." && pwd)
main=$(dirname "$(git -C "$repo" rev-parse --path-format=absolute --git-common-dir)")
target="$(dirname "$main")/accord_mobile_v4-$name"
branch="port/$name"

if [ -d "$target" ]; then
  echo "Already exists: $target"
  exit 0
fi

if git -C "$main" show-ref --verify --quiet "refs/heads/$branch"; then
  git -C "$main" worktree add --quiet "$target" "$branch"
else
  git -C "$main" worktree add --quiet -b "$branch" "$target" "$base"
fi

if ! cp -cR "$main/node_modules" "$target/node_modules" 2>/dev/null; then
  rm -rf "$target/node_modules"
  (cd "$target" && npm ci --silent)
fi
[ -f "$main/expo-env.d.ts" ] && cp "$main/expo-env.d.ts" "$target/expo-env.d.ts"
[ -d "$main/.expo/types" ] && mkdir -p "$target/.expo" && cp -cR "$main/.expo/types" "$target/.expo/types"

echo "Ready: $target"
echo "Branch: $branch (from $base)"
echo "Open this folder in Codex and give it the session's prompt from docs/port/README.md."
