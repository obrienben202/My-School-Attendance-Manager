#!/bin/bash
set -euo pipefail

echo "==> Building API server bundle..."
pnpm --filter @workspace/api-server run build

echo "==> Build complete."
