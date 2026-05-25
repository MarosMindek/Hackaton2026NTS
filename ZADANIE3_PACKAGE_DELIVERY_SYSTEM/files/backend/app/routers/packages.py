from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Package
from app.schemas import PackageRead

router = APIRouter(prefix="/packages", tags=["packages"])


@router.get("", response_model=list[PackageRead])
def list_packages(
    zone: str | None = Query(None),
    priority: str | None = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    stmt = select(Package)
    if zone:
        stmt = stmt.where(Package.city_district == zone)
    if priority:
        stmt = stmt.where(Package.priority == priority)
    stmt = stmt.order_by(Package.id).limit(limit).offset(offset)
    return db.execute(stmt).scalars().all()


@router.get("/count")
def count_packages(
    zone: str | None = Query(None),
    db: Session = Depends(get_db),
):
    from sqlalchemy import func
    stmt = select(func.count(Package.id))
    if zone:
        stmt = stmt.where(Package.city_district == zone)
    return {"count": db.execute(stmt).scalar_one()}


@router.get("/unresolved", response_model=list[PackageRead])
def list_unresolved(
    zone: str | None = Query(None),
    priority: str | None = Query(None),
    search: str | None = Query(None),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    stmt = select(Package).where(Package.geocode_status.in_(["fallback", "out_of_district"]))
    if zone:
        stmt = stmt.where(Package.city_district == zone)
    if priority:
        stmt = stmt.where(Package.priority == priority)
    if search:
        like = f"%{search}%"
        from sqlalchemy import or_
        stmt = stmt.where(
            or_(
                Package.barcode.ilike(like),
                Package.recipient_name.ilike(like),
                Package.address.ilike(like),
            )
        )
    stmt = stmt.order_by(Package.city_district, Package.id).limit(limit).offset(offset)
    return db.execute(stmt).scalars().all()


@router.get("/unresolved/geojson")
def unresolved_geojson(db: Session = Depends(get_db)):
    pkgs = db.execute(
        select(Package).where(Package.geocode_status.in_(["fallback", "out_of_district"]))
    ).scalars().all()
    features = [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [p.lon, p.lat]},
            "properties": {
                "package_id":     p.id,
                "barcode":        p.barcode,
                "recipient_name": p.recipient_name,
                "address":        p.address,
                "city_district":  p.city_district,
                "priority":       p.priority,
                "weight_kg":      p.weight_kg,
                "fragile":        p.fragile,
                "color":          "#f97316",
                "unresolved":     True,
            },
        }
        for p in pkgs
    ]
    return {"type": "FeatureCollection", "features": features}
