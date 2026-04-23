#!/bin/bash
# Move to the root directory of the project
cd "$(dirname "$0")/.."

echo "Syncing with GitHub..."
git pull origin main

echo "Sync complete!"
