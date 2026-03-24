#!/usr/bin/env bash
set -euo pipefail

VM="anton.jackson@35.184.205.244"
VM_DIR="~/strava-mcp"
SSH_KEY="$HOME/.ssh/google_compute_engine"
SSH="ssh -i $SSH_KEY"
SCP="scp -i $SSH_KEY"

echo "==> Building..."
npm run build

echo "==> Syncing files to VM..."
# Sync compiled output, scripts, and package manifests (not node_modules)
tar czf /tmp/strava-mcp-deploy.tar.gz \
  dist/ \
  scripts/ \
  package.json \
  package-lock.json

$SCP /tmp/strava-mcp-deploy.tar.gz "$VM:/tmp/"

$SSH "$VM" bash <<'REMOTE'
  set -euo pipefail
  cd ~/strava-mcp

  echo "==> Extracting..."
  tar xzf /tmp/strava-mcp-deploy.tar.gz

  echo "==> Installing dependencies (if changed)..."
  npm ci --omit=dev --prefer-offline

  echo "==> Restarting service..."
  sudo systemctl restart strava-mcp

  echo "==> Done. Checking status..."
  sudo systemctl is-active strava-mcp
REMOTE

echo "==> Deploy complete."
