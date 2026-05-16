#!/bin/sh
set -u

echo "Preparing database schema..."
if ! npx prisma migrate deploy; then
  echo "Migration deploy failed; attempting init migration recovery..."
  npx prisma migrate resolve --rolled-back 20260516000000_init || true
  if ! npx prisma migrate deploy; then
    npx prisma db push --accept-data-loss && npx prisma migrate resolve --applied 20260516000000_init || true
  fi
fi

echo "Starting Shift Companion..."
if [ -f ".next/standalone/server.js" ]; then
  exec node .next/standalone/server.js
fi

if [ -f "server.js" ]; then
  exec node server.js
fi

exec npx next start
