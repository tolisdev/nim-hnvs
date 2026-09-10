#!/bin/bash
# ==============================================================================
# nim-hnvs Automated / Manual Update Script
# ==============================================================================
set -e

echo "===> Updating nim-hnvs to latest version..."

# Pull latest code from git
git pull origin main

# Build or pull latest images and restart
docker compose up --build -d --remove-orphans

# Clean up dangling images
docker image prune -f

echo "===> nim-hnvs updated successfully!"
docker compose ps
