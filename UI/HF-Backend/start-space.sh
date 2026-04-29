#!/bin/sh
set -eu

export PORT="${PORT:-7860}"
export MODEL_PORT="${MODEL_PORT:-5000}"
export MODEL_ENDPOINT="${MODEL_ENDPOINT:-http://127.0.0.1:${MODEL_PORT}/colorize}"

cd /app/Model
gunicorn \
  --bind "127.0.0.1:${MODEL_PORT}" \
  --workers "${MODEL_WORKERS:-1}" \
  --timeout "${MODEL_TIMEOUT:-300}" \
  app:app &

model_pid="$!"

cleanup() {
  kill "${model_pid}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

cd /app/backend
exec node model-server.js
