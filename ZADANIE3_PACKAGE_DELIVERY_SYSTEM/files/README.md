# KE-Delivery

Hackathon delivery-optimization app — FastAPI backend, Vue 3 + OpenLayers frontend, PostgreSQL/PostGIS.

---

## Quick start (Docker — everything together)

```bash
docker compose up --build
```

| Service   | URL                        |
|-----------|----------------------------|
| Frontend  | http://localhost:5173      |
| Backend   | http://localhost:8000      |
| API docs  | http://localhost:8000/docs |
| Adminer   | http://localhost:8080      |

Stop everything:

```bash
docker compose down
```

Stop and wipe the database volume (full reset):

```bash
docker compose down -v
```

---

## Running locally (without Docker)

### Backend

Requires Python 3.11+ and a running PostgreSQL instance with PostGIS.

```bash
cd backend

# create & activate virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Linux / macOS

pip install -r requirements.txt

# copy and edit the env file
copy .env.example .env        # Windows
# cp .env.example .env        # Linux / macOS

uvicorn app.main:app --reload --port 8000
```

### Frontend

Requires Node 20+.

```bash
cd frontend
npm install
npm run dev          # dev server on http://localhost:5173
```

---

## Restart commands

### Restart only the backend container

```bash
docker compose restart backend
```

### Restart only the frontend container

```bash
docker compose restart frontend
```

### Rebuild and restart a single service (after code changes)

```bash
docker compose up --build backend   # rebuild backend image
docker compose up --build frontend  # rebuild frontend image
```

### Restart everything without wiping data

```bash
docker compose down && docker compose up --build
```

### View live logs

```bash
docker compose logs -f backend     # backend logs
docker compose logs -f frontend    # frontend logs
docker compose logs -f             # all services
```

---

## Local dev — restart after code changes

**Backend** (uvicorn `--reload` auto-restarts on file save, no command needed).
To do a manual restart:

```bash
# kill the running uvicorn and re-run:
uvicorn app.main:app --reload --port 8000
```

**Frontend** (Vite HMR auto-reloads the browser on file save, no command needed).
To do a full restart:

```bash
# Ctrl+C the running dev server, then:
npm run dev
```

---

## Real package coordinates (optional)

By default packages are placed at zone-centroid positions with a small deterministic jitter.
To place them on their **actual street addresses** run the geocoding script once (uses the free Photon/OSM API):

```bash
# From the repo root — no extra pip installs needed (stdlib only)
python backend/scripts/geocode.py
```

This takes ~6 minutes for ~1 050 packages and writes `backend/data/geocoded.json`.
Then rebuild and restart the backend so it picks up the real coordinates:

```bash
docker compose up --build backend
```

The script is resumable — if interrupted, re-run it and it will skip already-geocoded packages.

---

## Database

Seed data is loaded automatically on first startup from `backend/data/drivers.csv` and `backend/data/packages.csv`.

Re-seed from scratch (drops all data):

```bash
docker compose down -v && docker compose up --build
```

---

## Tech stack

| Layer     | Technology                              |
|-----------|-----------------------------------------|
| Backend   | FastAPI + SQLAlchemy 2 + psycopg        |
| Database  | PostgreSQL 17 + PostGIS (TimescaleDB image) |
| Frontend  | Vue 3 + TypeScript + Vite               |
| Map       | OpenLayers 10 + OSM tiles               |
| Routes    | OSRM public demo API                    |
| PDF       | jsPDF + jspdf-autotable                 |
| Container | Docker Compose                          |
