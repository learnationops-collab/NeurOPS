# Build Stage for React Frontend
FROM node:20-slim as frontend_builder

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
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
# libpq-dev is often needed for psycopg2 (PostgreSQL adapter)
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
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
CMD ["gunicorn", "--timeout", "120", "--bind", "0.0.0.0:8080", "run:app"]
