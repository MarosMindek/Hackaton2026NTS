---
name: project-ke-delivery
description: "KE-Delivery hackathon app (Úloha 3) — full-stack delivery route optimizer for Košice, built at c:\\dev_python\\ke-delivery"
metadata: 
  node_type: memory
  type: project
  originSessionId: ddaa1b0c-4927-4183-b912-ce837e85b931
---

KE-Delivery is a full-stack delivery optimization app built for AI Hackathon 2026 Úloha 3.

**Why:** Hackathon task — assign 1,050 packages to 58 drivers across 18 Košice city districts, respecting zone, weight, volume, and package-count constraints. Priority: Overnight > Expres > Štandard > Ekonomický.

**How to apply:** Use this context when the user refers to the delivery app, ke-delivery, or Úloha 3.

**Location:** `c:\dev_python\ke-delivery\`

**Stack:**
- Backend: FastAPI + SQLAlchemy 2 + psycopg + GeoAlchemy2, port 8000
- DB: PostgreSQL/PostGIS via timescale/timescaledb-ha:pg17 image
- Frontend: Vue 3 + TypeScript + OpenLayers (ol) + Pinia + Vue Router, port 5173 (dev) / 5173 (nginx in Docker)
- Docker: single `docker-compose.yml` at project root — composes postgres, backend, frontend, adminer

**To run (Docker):** `cd ke-delivery && docker compose up --build`
**To run (dev):** Start docker-compose for postgres+backend, then `cd frontend && npm install && npm run dev`

**Key endpoints:**
- `POST /optimize` → runs greedy bin-packing assignment
- `GET /stats` → zone + driver utilization
- `GET /assignments/geojson` → OL map feed
- `GET /unassigned/geojson` → unassigned packages in red on map

**Zone centroids:** Option B (approximate centroids) — defined in `backend/app/zones.py`
**Seed:** Auto-runs at backend startup from `backend/data/drivers.csv` and `backend/data/packages.csv`
**No auth:** Keycloak was intentionally skipped.

**Reference app:** [[project-caves-sample-app]] (CavesSkSampleApp) — same infrastructure pattern.
