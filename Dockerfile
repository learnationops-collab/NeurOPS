# Las imágenes base salen del espejo público de AWS (public.ecr.aws/docker/library) y no de Docker
# Hub: el 09/10/2026 tres builds seguidos de Railway fallaron con «429 Too Many Requests» al bajar
# node:20-slim y python:3.11-slim (Docker Hub limita las descargas anónimas por IP, y los builders
# de Railway las comparten). Son las mismas imágenes oficiales, con el mismo digest.

# Build Stage for React Frontend
FROM public.ecr.aws/docker/library/node:20-slim AS frontend_builder

WORKDIR /app_build

# Copy frontend dependency files
COPY frontend/package.json frontend/package-lock.json ./

# Install dependencies
RUN npm ci

# Copy frontend source code
COPY frontend/ ./

# Build the React application
RUN npm run build

# Production Stage for Flask Backend
FROM public.ecr.aws/docker/library/python:3.11-slim

WORKDIR /app

# Install system dependencies
# libpq-dev for PostgreSQL, Chromium for html2image
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    chromium \
    chromium-driver \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    fonts-liberation \
    fonts-dejavu \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Remove frontend source code from the final image to keep it clean
RUN rm -rf frontend

# Copy built frontend assets from the builder stage
# Flask expects them in ../frontend/dist (relative to app/) -> /app/frontend/dist
COPY --from=frontend_builder /app_build/dist /app/frontend/dist

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

# Expose the port
EXPOSE 8080

# Run the application
CMD gunicorn --timeout 120 --bind 0.0.0.0:$PORT run:app
