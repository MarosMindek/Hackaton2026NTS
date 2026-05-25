from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Assignment, Driver, Package
from app.optimizer import run_optimization
from app.schemas import AssignmentRead, OptimizeResult
from app.seed import fix_package_districts, update_package_coords
from app.zones import ZONE_COLORS

router = APIRouter(prefix="", tags=["assignments"])


@router.post("/optimize", response_model=OptimizeResult)
def optimize(fix_districts: bool = False, db: Session = Depends(get_db)):
    if fix_districts:
        # Re-apply geocoded.json coordinates; district correction runs inside.
        districts_fixed = update_package_coords(db)
    else:
        # Always correct districts from current coordinates before optimising.
        districts_fixed = fix_package_districts(db)
    if districts_fixed:
        print(f"[district-fix] corrected {districts_fixed} package district(s)")
    result = run_optimization(db)
    result["districts_fixed"] = districts_fixed
    return result


@router.delete("/assignments")
def clear_assignments(db: Session = Depends(get_db)):
    from sqlalchemy import delete
    db.execute(delete(Assignment))
    db.commit()
    return {"status": "cleared"}


@router.get("/assignments", response_model=list[AssignmentRead])
def list_assignments(db: Session = Depends(get_db)):
    rows = db.execute(
        select(
            Assignment.id,
            Assignment.sequence_number,
            Driver.driver_id,
            Driver.first_name,
            Driver.last_name,
            Driver.zone_mestska_cast.label("zone"),
            Driver.vehicle_type,
            Driver.license_plate,
            Package.id.label("package_id"),
            Package.barcode,
            Package.recipient_name,
            Package.address,
            Package.city_district,
            Package.weight_kg,
            Package.volume_m3,
            Package.dimensions_cm,
            Package.priority,
            Package.fragile,
            Package.geocode_status,
            Package.lat,
            Package.lon,
            Package.special_instructions,
        )
        .join(Driver, Driver.driver_id == Assignment.driver_id)
        .join(Package, Package.id == Assignment.package_id)
        .order_by(Driver.zone_mestska_cast, Driver.driver_id, Assignment.sequence_number)
    ).mappings().all()

    return [AssignmentRead(**row) for row in rows]


@router.get("/assignments/geojson")
def assignments_geojson(db: Session = Depends(get_db)):
    rows = db.execute(
        select(
            Assignment.id,
            Driver.driver_id,
            Driver.first_name,
            Driver.last_name,
            Driver.zone_mestska_cast.label("zone"),
            Driver.vehicle_type,
            Package.id.label("package_id"),
            Package.barcode,
            Package.recipient_name,
            Package.address,
            Package.weight_kg,
            Package.priority,
            Package.fragile,
            Package.size,
            Package.geocode_status,
            Package.lat,
            Package.lon,
        )
        .join(Driver, Driver.driver_id == Assignment.driver_id)
        .join(Package, Package.id == Assignment.package_id)
    ).mappings().all()

    features = []
    for r in rows:
        zone = r["zone"]
        color = ZONE_COLORS.get(zone, "#888888")
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [r["lon"], r["lat"]]},
            "properties": {
                "package_id":     r["package_id"],
                "barcode":        r["barcode"],
                "recipient_name": r["recipient_name"],
                "address":        r["address"],
                "driver_id":      r["driver_id"],
                "driver_name":    f"{r['first_name']} {r['last_name']}",
                "zone":           zone,
                "vehicle_type":   r["vehicle_type"],
                "priority":       r["priority"],
                "weight_kg":      r["weight_kg"],
                "fragile":        r["fragile"],
                "size":           r["size"],
                "geocode_status": r["geocode_status"],
                "color":          color,
            },
        })

    return {"type": "FeatureCollection", "features": features}


@router.get("/unassigned/geojson")
def unassigned_geojson(db: Session = Depends(get_db)):
    assigned_ids = db.execute(select(Assignment.package_id)).scalars().all()
    stmt = select(Package).where(Package.geocode_status.not_in(["fallback", "out_of_district"]))
    if assigned_ids:
        stmt = stmt.where(Package.id.not_in(assigned_ids))

    pkgs = db.execute(stmt).scalars().all()
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
                "geocode_status": p.geocode_status,
                "color":          "#ef4444",
            },
        }
        for p in pkgs
    ]
    return {"type": "FeatureCollection", "features": features}
