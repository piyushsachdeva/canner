#!/usr/bin/env bash
set -euo pipefail
echo "Installing test deps (backend)..."
python -m pip install --upgrade pip >/dev/null
pip install -r backend/requirements.txt
pip install -r backend/requirements-dev.txt
echo "Running backend pytest..."
pytest backend/tests -q
