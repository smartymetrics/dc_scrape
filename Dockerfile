# Use Python 3.11 slim image
FROM python:3.11-slim

# Install system dependencies for Playwright and Chromium
# Using a cleaner, consolidated list.
RUN apt-get update && apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libu2f-udev \
    libvulkan1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# CRITICAL FIX 1: Install Playwright and Chromium browser
# This resolves the "Executable doesn't exist" error.
# The `playwright install chromium` command is sufficient here.
RUN playwright install chromium

# Copy application code
COPY . .

# Create data directory for persistence
RUN mkdir -p /app/data

# Expose port
EXPOSE 5000

# Set environment variables
ENV PYTHONUNBUFFERED=1
# Optional: Setting this tells Playwright where to look.
ENV PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright/

# CRITICAL FIX 2: Change worker class from eventlet to gthread
# Eventlet breaks Python's threading and asyncio model, causing your previous FATAL errors.
# gthread (standard threading) is required because your app.py uses threading and nest_asyncio.
# We also use $PORT provided by Render for the bind address.
CMD ["gunicorn", "--worker-class", "gthread", "--threads", "4", "--timeout", "300", "--keep-alive", "5", "--bind", "0.0.0.0:$PORT", "wsgi:application"]