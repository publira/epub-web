#!/usr/bin/env bash

# Docker Engine has no automatic image garbage collection, and the inner
# daemon's storage is a volume that outlives Dev Container rebuilds, so images
# pulled or built here would pile up on the host disk forever. BuildKit's build
# cache is bounded by .devcontainer/daemon.json instead.
#
# Deliberately without `set -e`: a slow or absent dockerd must not fail the
# container start.

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
