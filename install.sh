#!/bin/bash
# HelmCode wrapper — delegates to the Node.js implementation.
# Requires Node.js >= 18 (same as package.json engines).
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "$SCRIPT_DIR/bin/helmcode.mjs" "$@"
