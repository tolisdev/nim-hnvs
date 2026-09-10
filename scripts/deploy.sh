#!/bin/bash
# ==============================================================================
# nim-hnvs Deployment Script for Linux / VPS
# ==============================================================================
set -e

echo "===> Deploying nim-hnvs..."

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed. Please install Docker first."
    exit 1
fi

# Ensure .env exists
if [ ! -f ".env" ]; then
    if [ -f ".env.docker.example" ]; then
        echo "Creating .env from .env.docker.example..."
        cp .env.docker.example .env
        echo "IMPORTANT: Please edit .env with your real credentials and API keys!"
    else
        touch .env
    fi
fi

# Ensure storage directories exist
mkdir -p backend/storage/pages backend/storage/pdfs

# Build and start services
echo "===> Starting Docker Compose services..."
docker compose up --build -d --remove-orphans

echo "===> Deployment completed successfully!"
docker compose ps
