#!/usr/bin/env bash
set -euo pipefail

mkdir -p static/vendor
cp node_modules/alpinejs/dist/cdn.min.js static/vendor/alpine.min.js
