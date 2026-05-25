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

# SQLite lives next to the backend code. Free-tier Render has no persistent
# disk; history resets on each deploy/restart (acceptable for MVP — anonymous
# users use localStorage, signed-in users see a fresh DB after cold starts).
RUN mkdir -p /app/backend/data
ENV DATABASE_URL=sqlite:////app/backend/data/diagramai.db

EXPOSE 8000

WORKDIR /app/backend
CMD ["python", "app.py"]
