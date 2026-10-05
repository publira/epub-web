#!/usr/bin/env bash

# Docker Engine never prunes images on its own, and the inner daemon's storage
# outlives Dev Container rebuilds. No `set -e`: a slow or absent dockerd must
# not fail the container start.

set -uo pipefail

readonly timeout=30

for _ in $(seq "${timeout}"); do
	if docker info >/dev/null 2>&1; then
		docker image prune --all --force --filter "until=168h" || true
		exit 0
	fi
	sleep 1
done

echo "dockerd did not become ready within ${timeout}s; skipping the image prune." >&2
