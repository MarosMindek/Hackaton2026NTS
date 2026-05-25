import csv
import json
from datetime import date
from pathlib import Path

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models import Driver, Package
from app.zones import get_zone_centroid, point_in_zone_polygon

DATA_DIR = Path(__file__).parent.parent / "data"
GEOCODED_FILE = DATA_DIR / "geocoded.json"


def _parse_float(value: str) -> float | None:
    try:
        return float(value.strip()) if value.strip() else None
    except ValueError:
        return None


def _parse_int(value: str, default: int = 0) -> int:
    try:
        return int(float(value.strip())) if value.strip() else default
    except ValueError:
        return default


def _parse_bool(value: str) -> bool:
    return value.strip().lower() in ("áno", "yes", "true", "1")


def _parse_date(value: str) -> date | None:
    try:
        return date.fromisoformat(value.strip()) if value.strip() else None
    except ValueError:
        return None


def _parse_volume(dimensions_cm: str) -> float:
    try:
        parts = dimensions_cm.lower().split("x")
        w, h, d = float(parts[0]), float(parts[1]), float(parts[2])
        return (w * h * d) / 1_000_000
    except Exception:
        return 0.001


def seed_drivers(db: Session) -> None:
    path = DATA_DIR / "drivers.csv"
    with open(path, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            zone = row["zone_mestska_cast"].strip()
            lat, lon = get_zone_centroid(zone)
            driver = Driver(
                driver_id=row["driver_id"].strip(),
                first_name=row["first_name"].strip(),
                last_name=row["last_name"].strip(),
                phone=row["phone"].strip(),
                vehicle_id=row["vehicle_id"].strip(),
                vehicle_make_model=row["vehicle_make_model"].strip(),
                vehicle_type=row["vehicle_type"].strip(),
                license_plate=row["license_plate"].strip(),
                max_weight_kg=float(row["max_weight_kg"]),
                max_volume_m3=float(row["max_volume_m3"]),
                max_packages_count=_parse_int(row["max_packages_count"]),
                zone_mestska_cast=zone,
                years_experience=_parse_int(row["years_experience"]),
                shift_start=row["shift_start"].strip(),
                shift_end=row["shift_end"].strip(),
                notes=row.get("notes", "").strip() or None,
                lat=lat,
                lon=lon,
            )
            db.merge(driver)
    db.commit()


def seed_packages(db: Session) -> None:
    path = DATA_DIR / "packages.csv"
    with open(path, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            pkg_id = int(row["id"])
            zone = row["city_district"].strip()
            lat, lon = get_zone_centroid(zone)
            pkg = Package(
                id=pkg_id,
                barcode=row["barcode"].strip(),
                recipient_name=row["recipient_name"].strip(),
                address=row["address"].strip(),
                city_district=zone,
                package_type=row["package_type"].strip(),
                size=row["size"].strip(),
                dimensions_cm=row["dimensions_cm"].strip() or None,
                weight_kg=float(row["weight_kg"]),
                volume_m3=_parse_volume(row["dimensions_cm"]),
                fragile=_parse_bool(row["fragile"]),
                priority=row["priority"].strip(),
                payment_method=row["payment_method"].strip(),
                cod_amount_eur=_parse_float(row["cod_amount_eur"]),
                insurance_value_eur=_parse_float(row["insurance_value_eur"]),
                special_instructions=row.get("special_instructions", "").strip() or None,
                order_date=_parse_date(row.get("order_date", "")),
                status=row.get("status", "Čaká na doručenie").strip(),
                lat=lat,
                lon=lon,
            )
            db.merge(pkg)
    db.commit()


def update_package_coords(db: Session) -> int:
    """Apply geocoded coordinates from geocoded.json and auto-correct districts.

    ZONE_FALLBACK entries are marked geocode_status='fallback' (coords unchanged).
    All GEOCODED_* entries get their coordinates applied. Coordinates that land
    outside the expected district polygon are still used but temporarily marked
    'out_of_district'; the district correction pass below then fixes city_district
    using real ArcGIS polygon data so the package ends up with the right driver.

    Returns the number of packages whose district was corrected.
    """
    if not GEOCODED_FILE.exists():
        return 0
    with open(GEOCODED_FILE, encoding="utf-8") as f:
        geocoded: dict[str, dict] = json.load(f)
    if not geocoded:
        return 0

    pkg_district: dict[int, str] = {
        row.id: row.city_district
        for row in db.execute(select(Package.id, Package.city_district)).all()
    }

    applied = 0
    skipped_status = 0
    out_of_district = 0

    for pkg_id_str, coords in geocoded.items():
        pkg_id = int(pkg_id_str)
        status = coords.get("status", "LEGACY_UNKNOWN")
        if not status.startswith("GEOCODED_"):
            if status == "ZONE_FALLBACK":
                db.execute(
                    update(Package)
                    .where(Package.id == pkg_id)
                    .values(geocode_status="fallback")
                )
            skipped_status += 1
            continue

        district = pkg_district.get(pkg_id)
        base_qual = "address" if status == "GEOCODED_ADDRESS" else "street"
        if district and not point_in_zone_polygon(coords["lat"], coords["lon"], district):
            geocode_qual = "out_of_district"
            out_of_district += 1
        else:
            geocode_qual = base_qual

        db.execute(
            update(Package)
            .where(Package.id == pkg_id)
            .values(lat=coords["lat"], lon=coords["lon"], geocode_status=geocode_qual)
        )
        applied += 1

    db.commit()
    print(
        f"Geocoded coords: {applied} applied "
        f"({out_of_district} out-of-district flagged), "
        f"{skipped_status} skipped (bad status)."
    )

    # Always correct districts based on actual polygon data.
    # geocode.py now ignores the CSV district, so coordinates may be in a
    # different district than the CSV says — fix that here automatically.
    fixed = fix_package_districts(db)
    if fixed:
        print(f"Auto-corrected {fixed} package district(s) via polygon lookup.")
    return fixed


def fix_package_districts(db: Session) -> int:
    """
    For every geocoded (non-fallback) package, look up which district polygon
    its coordinate actually falls in and correct city_district if it differs.

    Packages whose coordinate is outside all 18 district polygons (e.g. a
    nearby village) are left unchanged — the original CSV district is the best
    available guess and we don't want to silently discard it.

    Returns the number of packages whose district was corrected.
    """
    from app.zones import find_zone_for_point

    rows = db.execute(
        select(Package.id, Package.lat, Package.lon, Package.city_district, Package.geocode_status)
        .where(Package.geocode_status.is_not(None))
        .where(Package.geocode_status != "fallback")
    ).all()

    fixed = 0
    for row in rows:
        actual_zone = find_zone_for_point(row.lat, row.lon)
        if actual_zone is None:
            continue  # outside all polygons — keep CSV district as-is
        if actual_zone == row.city_district:
            continue  # already correct

        new_status = "address" if row.geocode_status == "out_of_district" else row.geocode_status
        db.execute(
            update(Package)
            .where(Package.id == row.id)
            .values(city_district=actual_zone, geocode_status=new_status)
        )
        fixed += 1

    db.commit()
    return fixed


def run_seed(db: Session) -> None:
    driver_count = db.execute(select(func.count(Driver.driver_id))).scalar_one()
    if driver_count > 0:
        return
    print("Seeding drivers and packages from CSV files…")
    seed_drivers(db)
    seed_packages(db)
    print("Seeding complete.")
