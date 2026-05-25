from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Assignment, DeliveryEvent, Driver, FAILURE_REASONS, Package

router = APIRouter(prefix="/driver", tags=["driver-view"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class StopOut(BaseModel):
    sequence_number: int
    package_id:      int
    barcode:         str
    recipient_name:  str
    address:         str
    weight_kg:       float
    priority:        str
    fragile:         bool
    cod_amount_eur:  float | None
    special_instructions: str | None
    geocode_status:  str | None
    lat:             float
    lon:             float
    status:          str | None   # "delivered" | "failed" | None
    reason:          str | None
    note:            str | None


class TodayResponse(BaseModel):
    driver_id:   str
    first_name:  str
    last_name:   str
    date:        date
    stops:       list[StopOut]
    delivered:   int
    failed:      int
    pending:     int


class DeliverBody(BaseModel):
    note: str | None = None


class FailBody(BaseModel):
    reason: str
    note:   str | None = None


class HistoryDay(BaseModel):
    date:      date
    delivered: int
    failed:    int
    total:     int


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_driver(driver_id: str, db: Session) -> Driver:
    drv = db.get(Driver, driver_id)
    if not drv:
        raise HTTPException(404, f"Driver {driver_id!r} not found")
    return drv


def _upsert_event(
    db: Session,
    driver_id: str,
    package_id: int,
    today: date,
    status: str,
    reason: str | None,
    note: str | None,
) -> DeliveryEvent:
    existing = db.execute(
        select(DeliveryEvent).where(
            DeliveryEvent.driver_id  == driver_id,
            DeliveryEvent.package_id == package_id,
            DeliveryEvent.date       == today,
        )
    ).scalar_one_or_none()

    if existing:
        existing.status = status
        existing.reason = reason
        existing.note   = note
        db.commit()
        return existing

    ev = DeliveryEvent(
        driver_id=driver_id,
        package_id=package_id,
        date=today,
        status=status,
        reason=reason,
        note=note,
    )
    db.add(ev)
    db.commit()
    return ev


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/{driver_id}/today", response_model=TodayResponse)
def get_today(driver_id: str, db: Session = Depends(get_db)):
    drv   = _get_driver(driver_id, db)
    today = date.today()

    assignments: list[Assignment] = db.execute(
        select(Assignment)
        .where(Assignment.driver_id == driver_id)
        .order_by(Assignment.sequence_number)
    ).scalars().all()

    pkg_ids = [a.package_id for a in assignments]
    pkgs: dict[int, Package] = {}
    for pkg in db.execute(select(Package).where(Package.id.in_(pkg_ids))).scalars().all():
        pkgs[pkg.id] = pkg

    events: dict[int, DeliveryEvent] = {}
    for ev in db.execute(
        select(DeliveryEvent).where(
            DeliveryEvent.driver_id == driver_id,
            DeliveryEvent.date      == today,
        )
    ).scalars().all():
        events[ev.package_id] = ev

    stops: list[StopOut] = []
    for asgn in assignments:
        pkg = pkgs.get(asgn.package_id)
        if not pkg:
            continue
        ev = events.get(pkg.id)
        stops.append(StopOut(
            sequence_number=asgn.sequence_number,
            package_id=pkg.id,
            barcode=pkg.barcode,
            recipient_name=pkg.recipient_name,
            address=pkg.address,
            weight_kg=pkg.weight_kg,
            priority=pkg.priority,
            fragile=pkg.fragile,
            cod_amount_eur=pkg.cod_amount_eur,
            special_instructions=pkg.special_instructions,
            geocode_status=pkg.geocode_status,
            lat=pkg.lat,
            lon=pkg.lon,
            status=ev.status if ev else None,
            reason=ev.reason if ev else None,
            note=ev.note   if ev else None,
        ))

    delivered = sum(1 for s in stops if s.status == "delivered")
    failed    = sum(1 for s in stops if s.status == "failed")
    pending   = len(stops) - delivered - failed

    return TodayResponse(
        driver_id=drv.driver_id,
        first_name=drv.first_name,
        last_name=drv.last_name,
        date=today,
        stops=stops,
        delivered=delivered,
        failed=failed,
        pending=pending,
    )


@router.post("/{driver_id}/packages/{package_id}/delivered", response_model=StopOut)
def mark_delivered(driver_id: str, package_id: int, body: DeliverBody = DeliverBody(), db: Session = Depends(get_db)):
    _get_driver(driver_id, db)
    pkg = db.get(Package, package_id)
    if not pkg:
        raise HTTPException(404, "Package not found")

    ev = _upsert_event(db, driver_id, package_id, date.today(), "delivered", None, body.note)
    asgn = db.execute(
        select(Assignment).where(Assignment.driver_id == driver_id, Assignment.package_id == package_id)
    ).scalar_one_or_none()

    return StopOut(
        sequence_number=asgn.sequence_number if asgn else 0,
        package_id=pkg.id,
        barcode=pkg.barcode,
        recipient_name=pkg.recipient_name,
        address=pkg.address,
        weight_kg=pkg.weight_kg,
        priority=pkg.priority,
        fragile=pkg.fragile,
        cod_amount_eur=pkg.cod_amount_eur,
        special_instructions=pkg.special_instructions,
        geocode_status=pkg.geocode_status,
        lat=pkg.lat,
        lon=pkg.lon,
        status=ev.status,
        reason=ev.reason,
        note=ev.note,
    )


@router.post("/{driver_id}/packages/{package_id}/failed", response_model=StopOut)
def mark_failed(driver_id: str, package_id: int, body: FailBody, db: Session = Depends(get_db)):
    _get_driver(driver_id, db)
    if body.reason not in FAILURE_REASONS:
        raise HTTPException(400, f"reason must be one of {FAILURE_REASONS}")
    pkg = db.get(Package, package_id)
    if not pkg:
        raise HTTPException(404, "Package not found")

    ev = _upsert_event(db, driver_id, package_id, date.today(), "failed", body.reason, body.note)
    asgn = db.execute(
        select(Assignment).where(Assignment.driver_id == driver_id, Assignment.package_id == package_id)
    ).scalar_one_or_none()

    return StopOut(
        sequence_number=asgn.sequence_number if asgn else 0,
        package_id=pkg.id,
        barcode=pkg.barcode,
        recipient_name=pkg.recipient_name,
        address=pkg.address,
        weight_kg=pkg.weight_kg,
        priority=pkg.priority,
        fragile=pkg.fragile,
        cod_amount_eur=pkg.cod_amount_eur,
        special_instructions=pkg.special_instructions,
        geocode_status=pkg.geocode_status,
        lat=pkg.lat,
        lon=pkg.lon,
        status=ev.status,
        reason=ev.reason,
        note=ev.note,
    )


@router.delete("/{driver_id}/packages/{package_id}/status", response_model=dict)
def undo_status(driver_id: str, package_id: int, db: Session = Depends(get_db)):
    _get_driver(driver_id, db)
    today = date.today()
    ev = db.execute(
        select(DeliveryEvent).where(
            DeliveryEvent.driver_id  == driver_id,
            DeliveryEvent.package_id == package_id,
            DeliveryEvent.date       == today,
        )
    ).scalar_one_or_none()

    if ev:
        db.delete(ev)
        db.commit()

    return {"ok": True}


@router.get("/{driver_id}/history", response_model=list[HistoryDay])
def get_history(driver_id: str, db: Session = Depends(get_db)):
    _get_driver(driver_id, db)
    events: list[DeliveryEvent] = db.execute(
        select(DeliveryEvent)
        .where(DeliveryEvent.driver_id == driver_id)
        .order_by(DeliveryEvent.date.desc())
    ).scalars().all()

    by_date: dict[date, dict] = {}
    for ev in events:
        d = by_date.setdefault(ev.date, {"delivered": 0, "failed": 0, "total": 0})
        d["total"] += 1
        if ev.status == "delivered":
            d["delivered"] += 1
        elif ev.status == "failed":
            d["failed"] += 1

    return [
        HistoryDay(date=dt, delivered=v["delivered"], failed=v["failed"], total=v["total"])
        for dt, v in sorted(by_date.items(), reverse=True)
    ]


@router.get("/failure-reasons", response_model=list[str])
def list_failure_reasons():
    return FAILURE_REASONS
