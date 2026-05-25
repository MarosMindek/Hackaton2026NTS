import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.database import SessionLocal, engine
from app.models import Base
from app.routers import assignments, driver_view, drivers, packages, routes, stats, zones
from app.seed import fix_package_districts, run_seed, update_package_coords


def _wait_for_db(retries: int = 20, delay: float = 3.0) -> None:
    for attempt in range(retries):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return
        except OperationalError:
            if attempt == retries - 1:
                raise
            print(f"DB not ready, retry {attempt + 1}/{retries}…")
            time.sleep(delay)


@asynccontextmanager
async def lifespan(app: FastAPI):
    _wait_for_db()
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        run_seed(db)
        update_package_coords(db)
        fix_package_districts(db)
    yield


app = FastAPI(title="KE-Delivery API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(drivers.router)
app.include_router(packages.router)
app.include_router(assignments.router)
app.include_router(stats.router)
app.include_router(routes.router)
app.include_router(zones.router)
app.include_router(driver_view.router)


@app.get("/")
def root():
    return {"service": "KE-Delivery API", "status": "ok"}


@app.get("/health")
def health():
    return {"status": "ok"}
