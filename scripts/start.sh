#!/bin/sh
set -u

echo "Preparing database schema..."
npx prisma migrate resolve --rolled-back 20260516000000_init || true
npx prisma migrate deploy || npx prisma db push --accept-data-loss || true

echo "Starting Shift Companion..."
if [ -f ".next/standalone/server.js" ]; then
  exec node .next/standalone/server.js
fi

if [ -f "server.js" ]; then
  exec node server.js
fi

exec npx next start
