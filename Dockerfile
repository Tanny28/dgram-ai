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

# Persistent data dir for SQLite. Render mounts a disk here in production
# (configured via render.yaml). Locally this is just an empty folder inside
# the container — DATABASE_URL falls back to ./diagramai.db if not overridden.
RUN mkdir -p /data
ENV DATABASE_URL=sqlite:////data/diagramai.db

EXPOSE 8000

WORKDIR /app/backend
CMD ["python", "app.py"]
