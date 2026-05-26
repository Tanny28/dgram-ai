FROM python:3.11-slim

RUN apt-get update && apt-get install -y graphviz curl && rm -rf /var/lib/apt/lists/*

# Install Node for frontend build
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs

WORKDIR /app

# Backend deps
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Frontend build
COPY frontend/ frontend/
RUN cd frontend && npm ci && npm run build

# Backend code
COPY backend/ backend/

# DATABASE_URL is injected at runtime via Render env vars (Neon PostgreSQL).
# Falls back to local SQLite for development if the env var is not set.
ENV DATABASE_URL=sqlite:////app/backend/data/diagramai.db
RUN mkdir -p /app/backend/data

EXPOSE 8000

WORKDIR /app/backend
CMD ["python", "app.py"]
