#!/usr/bin/env bash
# Deploys the Next.js standalone build to the production VPS.
# Replaces the old Bitvise sftpc/sexec flow with plain OpenSSH (ssh/scp),
# since the VPS no longer accepts password auth (key-only since 2026-07-20).
set -euo pipefail

REMOTE_HOST="${DEPLOY_HOST:-138.219.41.253}"
REMOTE_USER="${DEPLOY_USER:-root}"
SSH_KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/nailsmanager_vps}"
RELEASES_DIR="/var/www/pwa/releases"
CURRENT_LINK="/var/www/pwa/current"
SHARED_ENV="/var/www/pwa/shared/.env.production"
PM2_APP="pwa"
KEEP_RELEASES=2
HEALTH_URL="https://app.turnetto.com/"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ssh_remote() {
  ssh -i "$SSH_KEY" -o BatchMode=yes "$REMOTE_USER@$REMOTE_HOST" "$@"
}

echo "==> Building..."
npm run build

if [ ! -f ".next/standalone/server.js" ]; then
  echo "ERROR: .next/standalone/server.js not found after build." >&2
  exit 1
fi

TS="$(date +%Y%m%d%H%M%S)"
REMOTE_RELEASE="$RELEASES_DIR/$TS"
TARBALL="/tmp/pwa-release-$TS.tar.gz"

echo "==> Packing build..."
tar -czf "$TARBALL" -C .next/standalone .

echo "==> Uploading to $REMOTE_HOST:$REMOTE_RELEASE..."
ssh_remote "mkdir -p '$REMOTE_RELEASE'"
scp -i "$SSH_KEY" -o BatchMode=yes "$TARBALL" "$REMOTE_USER@$REMOTE_HOST:/tmp/$(basename "$TARBALL")"
rm -f "$TARBALL"

echo "==> Extracting and wiring shared env..."
# tar preserves the uploading machine's (Windows/git-bash synthetic) uid:gid, so
# normalize ownership to root:root to match the rest of the release tree.
ssh_remote "tar -xzf '/tmp/$(basename "$TARBALL")' -C '$REMOTE_RELEASE' && rm -f '/tmp/$(basename "$TARBALL")' && chown -R root:root '$REMOTE_RELEASE' && rm -f '$REMOTE_RELEASE/.env.production' && ln -s '$SHARED_ENV' '$REMOTE_RELEASE/.env.production'"

PREVIOUS_RELEASE="$(ssh_remote "readlink -f '$CURRENT_LINK'" || true)"

echo "==> Swapping current -> $TS..."
ssh_remote "ln -sfn '$REMOTE_RELEASE' '$CURRENT_LINK'"

echo "==> Reloading PM2..."
ssh_remote "pm2 reload $PM2_APP"

echo "==> Pruning old releases (keeping last $KEEP_RELEASES)..."
ssh_remote "cd '$RELEASES_DIR' && ls -1t | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf --"

echo "==> Health check..."
sleep 2
HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$HEALTH_URL" || echo '000')"

if [ "$HTTP_CODE" != "200" ]; then
  echo "WARNING: health check returned $HTTP_CODE (expected 200)." >&2
  if [ -n "$PREVIOUS_RELEASE" ]; then
    echo "Rollback: ssh -i \"$SSH_KEY\" $REMOTE_USER@$REMOTE_HOST \"ln -sfn '$PREVIOUS_RELEASE' '$CURRENT_LINK' && pm2 reload $PM2_APP\"" >&2
  fi
  exit 1
fi

echo "==> Deploy OK. Release $TS is live ($HEALTH_URL -> 200)."
echo "    Verify manually that any new feature/route in this deploy actually shows up (not cached)."
