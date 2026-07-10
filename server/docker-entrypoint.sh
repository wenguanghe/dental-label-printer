#!/bin/sh
set -e

echo "========================================="
echo "  Dental Sterilization Print System"
echo "  Starting..."
echo "========================================="

echo "[1/3] Running database migration..."
npx prisma db push --accept-data-loss 2>&1

echo "[2/3] Checking seed data..."
node src/seed-check.js

echo "[3/3] Starting server on port ${PORT:-3000}..."
exec node src/index.js
