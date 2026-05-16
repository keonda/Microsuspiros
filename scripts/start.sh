#!/bin/sh
set -u

export HOSTNAME="0.0.0.0"
export PORT="${PORT:-3000}"
export UPLOAD_DIR="${UPLOAD_DIR:-/app/data/uploads}"

echo "Preparing database schema..."
mkdir -p "$UPLOAD_DIR"
if ! npx prisma migrate deploy; then
  echo "Migration deploy failed; attempting init migration recovery..."
  npx prisma migrate resolve --rolled-back 20260516000000_init || true
  if ! npx prisma migrate deploy; then
    npx prisma db push --accept-data-loss && npx prisma migrate resolve --applied 20260516000000_init || true
  fi
fi

echo "Starting Shift Companion..."
if [ -f ".next/standalone/server.js" ]; then
  mkdir -p .next/standalone/.next
  if [ -d ".next/static" ]; then
    rm -rf .next/standalone/.next/static
    cp -R .next/static .next/standalone/.next/static
  fi
  if [ -d "public" ]; then
    rm -rf .next/standalone/public
    cp -R public .next/standalone/public
  fi
  exec node .next/standalone/server.js
fi

if [ -f "server.js" ]; then
  exec node server.js
fi

exec npx next start
