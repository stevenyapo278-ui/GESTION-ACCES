#!/bin/sh
set -e

echo "Cleaning up legacy constraints..."
npx prisma db execute --stdin <<SQL
ALTER TABLE cell_values DROP CONSTRAINT IF EXISTS fk_cell_value_owner;
ALTER TABLE cell_values DROP CONSTRAINT IF EXISTS fk_cell_value_assignee;
ALTER TABLE cell_values DROP COLUMN IF EXISTS assigneeId;
SQL

echo "Running Prisma db push..."
npx prisma db push --accept-data-loss

echo "Starting server..."
node dist/index.js
