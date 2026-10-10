#!/usr/bin/env bash
set -euo pipefail
TASK_REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TASK_TEST_RUNNER="$TASK_REPO_ROOT/scripts/.form-test-runner"
if [[ ! -d "$TASK_TEST_RUNNER/node_modules/jsdom" ]]; then
  npm install --prefix "$TASK_TEST_RUNNER" --no-save --ignore-scripts --package-lock=false jsdom@26.1.0
fi
NODE_PATH="$TASK_TEST_RUNNER/node_modules" node --test "$TASK_REPO_ROOT/scripts/test-forms.cjs"
