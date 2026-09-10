# Backend Dockerfile for nim-hnvs (Python Flask REST API)
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend

WORKDIR /app

# Install system dependencies needed for PyMuPDF, image rendering, curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy backend application code & api bridge
COPY backend /app/backend
COPY api /app/api

# Ensure storage directories exist
RUN mkdir -p /app/backend/storage/pages /app/backend/storage/pdfs

EXPOSE 5055

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:5055/api/lessons || exit 1

WORKDIR /app/backend

CMD ["gunicorn", "--bind", "0.0.0.0:5055", "--workers", "2", "--threads", "4", "--timeout", "120", "app:app"]
