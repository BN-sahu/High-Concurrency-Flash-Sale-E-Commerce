#!/bin/sh
echo "Starting background worker..."
node apps/worker/dist/index.js &

echo "Starting API server..."
node apps/api/dist/index.js
