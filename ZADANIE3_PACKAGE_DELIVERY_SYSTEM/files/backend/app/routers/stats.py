from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Assignment, Driver, Package
from app.schemas import DriverStat, StatsResponse, ZoneStat

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("", response_model=StatsResponse)
def get_stats(db: Session = Depends(get_db)):
    total_packages  = db.execute(select(func.count(Package.id))).scalar_one()
    total_assigned  = db.execute(select(func.count(Assignment.id))).scalar_one()
    total_unresolved = db.execute(
        select(func.count(Package.id)).where(
            Package.geocode_status.in_(["fallback", "out_of_district"])
        )
    ).scalar_one()

    # ── per-zone stats ────────────────────────────────────────────────────────
    all_drivers: list[Driver] = db.execute(select(Driver)).scalars().all()
    all_pkgs: list[Package]   = db.execute(select(Package)).scalars().all()
    all_asgn: list[Assignment] = db.execute(select(Assignment)).scalars().all()

    assigned_pkg_ids = {a.package_id for a in all_asgn}
    driver_asgn: dict[str, list[int]] = {}
    for a in all_asgn:
        driver_asgn.setdefault(a.driver_id, []).append(a.package_id)

    # Build zone → drivers mapping
    zone_driver_map: dict[str, list[Driver]] = {}
    for drv in all_drivers:
        zone_driver_map.setdefault(drv.zone_mestska_cast, []).append(drv)

    # Only routable packages count toward zone stats — unresolvable ones are
    # already excluded from optimization and shouldn't inflate zone numbers.
    UNROUTABLE = {"fallback", "out_of_district"}
    routable_pkgs = [p for p in all_pkgs if p.geocode_status not in UNROUTABLE]

    # Build zone → packages mapping (routable only)
    zone_pkg_map: dict[str, list[Package]] = {}
    for pkg in routable_pkgs:
        zone_pkg_map.setdefault(pkg.city_district, []).append(pkg)

    # Build pkg_id → weight/volume lookup
    pkg_weight:  dict[int, float] = {p.id: p.weight_kg  for p in all_pkgs}
    pkg_volume:  dict[int, float] = {p.id: p.volume_m3  for p in all_pkgs}

    all_zones = sorted(set(list(zone_pkg_map.keys()) + list(zone_driver_map.keys())))

    zone_stats: list[ZoneStat] = []
    for zone in all_zones:
        drvs   = zone_driver_map.get(zone, [])
        pkgs   = zone_pkg_map.get(zone, [])
        a_pkgs = [p for p in pkgs if p.id in assigned_pkg_ids]
        cap_w  = sum(d.max_weight_kg  for d in drvs)
        cap_v  = sum(d.max_volume_m3  for d in drvs)
        used_w = sum(p.weight_kg  for p in a_pkgs)
        used_v = sum(p.volume_m3  for p in a_pkgs)
        zone_stats.append(ZoneStat(
            zone=zone,
            total_packages=len(pkgs),
            assigned=len(a_pkgs),
            unassigned=len(pkgs) - len(a_pkgs),
            drivers=len(drvs),
            capacity_weight_kg=round(cap_w, 2),
            used_weight_kg=round(used_w, 2),
            weight_utilization_pct=round(used_w / cap_w * 100, 1) if cap_w > 0 else 0.0,
            capacity_volume_m3=round(cap_v, 4),
            used_volume_m3=round(used_v, 4),
            volume_utilization_pct=round(used_v / cap_v * 100, 1) if cap_v > 0 else 0.0,
        ))

    # ── per-driver stats ──────────────────────────────────────────────────────
    driver_stats: list[DriverStat] = []
    for drv in sorted(all_drivers, key=lambda d: (d.zone_mestska_cast, d.driver_id)):
        pkg_ids   = driver_asgn.get(drv.driver_id, [])
        a_count   = len(pkg_ids)
        a_weight  = sum(pkg_weight.get(pid, 0.0) for pid in pkg_ids)
        a_volume  = sum(pkg_volume.get(pid, 0.0) for pid in pkg_ids)
        driver_stats.append(DriverStat(
            driver_id=drv.driver_id,
            first_name=drv.first_name,
            last_name=drv.last_name,
            zone_mestska_cast=drv.zone_mestska_cast,
            vehicle_type=drv.vehicle_type,
            vehicle_make_model=drv.vehicle_make_model,
            license_plate=drv.license_plate,
            max_weight_kg=drv.max_weight_kg,
            max_volume_m3=drv.max_volume_m3,
            max_packages_count=drv.max_packages_count,
            assigned_packages=a_count,
            assigned_weight_kg=round(a_weight, 2),
            assigned_volume_m3=round(a_volume, 4),
            weight_utilization_pct=round(a_weight / drv.max_weight_kg * 100, 1) if drv.max_weight_kg > 0 else 0.0,
            volume_utilization_pct=round(a_volume / drv.max_volume_m3 * 100, 1) if drv.max_volume_m3 > 0 else 0.0,
            count_utilization_pct=round(a_count / drv.max_packages_count * 100, 1) if drv.max_packages_count > 0 else 0.0,
            lat=drv.lat,
            lon=drv.lon,
        ))

    return StatsResponse(
        total_packages=total_packages,
        assigned=total_assigned,
        unassigned=total_packages - total_assigned - total_unresolved,
        unresolved=total_unresolved,
        zones=zone_stats,
        drivers=driver_stats,
    )
