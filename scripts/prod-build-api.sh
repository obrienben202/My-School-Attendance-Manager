#!/bin/bash
set -e

echo "==> Pushing database schema to production..."
pnpm --filter @workspace/db run push-force

echo "==> Building API server bundle..."
pnpm --filter @workspace/api-server run build

echo "==> Build complete."
