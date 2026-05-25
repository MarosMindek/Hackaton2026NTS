import math
from collections import defaultdict

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Assignment, Driver, Package

router = APIRouter(prefix="/routes", tags=["routes"])

OSRM_BASE = "http://router.project-osrm.org"
MAX_TRIP_STOPS = 98  # /trip limit is 100 waypoints total; depot/cur_pos takes 1

PRIORITY_RANK: dict[str, int] = {
    "Overnight":   0,
    "Expres":      1,
    "Štandard":    2,
    "Ekonomický":  3,
}


def _straight_line_geometry(coords: list[tuple[float, float]]) -> dict:
    return {"type": "LineString", "coordinates": [[lon, lat] for lon, lat in coords]}


def _merge_geojson_lines(geoms: list[dict]) -> dict:
    coords: list = []
    for i, g in enumerate(geoms):
        pts = g.get("coordinates", [])
        coords.extend(pts if i == 0 else pts[1:])
    return {"type": "LineString", "coordinates": coords}


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6_371.0
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    dφ = math.radians(lat2 - lat1)
    dλ = math.radians(lon2 - lon1)
    a = math.sin(dφ / 2) ** 2 + math.cos(φ1) * math.cos(φ2) * math.sin(dλ / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


@router.get("/{driver_id}")
async def get_driver_route(driver_id: str, db: Session = Depends(get_db)):
    driver = db.execute(
        select(Driver).where(Driver.driver_id == driver_id)
    ).scalar_one_or_none()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    rows = db.execute(
        select(Package.lat, Package.lon, Package.id, Package.priority, Assignment.sequence_number)
        .join(Assignment, Assignment.package_id == Package.id)
        .where(Assignment.driver_id == driver_id)
        .order_by(Assignment.sequence_number)
    ).all()

    if not rows:
        return {
            "type": "Feature",
            "geometry": None,
            "properties": {
                "driver_id":         driver_id,
                "packages":          0,
                "distance_km":       0,
                "est_delivery_min":  0,
                "source":            "none",
                "reordered":         False,
            },
        }

    depot = (driver.lon, driver.lat)

    # Group stops by priority tier; preserve DB order within each tier
    tier_stops: dict[int, list[tuple[float, float, int]]] = defaultdict(list)
    for r in rows:
        tier = PRIORITY_RANK.get(r.priority, 99)
        tier_stops[tier].append((r.lon, r.lat, r.id))

    source           = "osrm"
    total_distance_m = 0.0
    total_duration_s = 0.0
    all_geometries:  list[dict] = []
    reordered        = False
    cur_pos          = depot  # tracks last road position across tiers

    try:
        for tier_rank in sorted(tier_stops.keys()):
            t_stops     = tier_stops[tier_rank]
            tier_coords = [cur_pos] + [(s[0], s[1]) for s in t_stops]

            if len(t_stops) == 1:
                # Single stop — straight-line geometry + haversine time estimate
                all_geometries.append(_straight_line_geometry(tier_coords))
                dist_km = _haversine_km(cur_pos[1], cur_pos[0], t_stops[0][1], t_stops[0][0])
                total_distance_m += dist_km * 1000
                total_duration_s += (dist_km / 30.0) * 3600  # 30 km/h city average
                cur_pos = (t_stops[0][0], t_stops[0][1])
                continue

            if len(t_stops) <= MAX_TRIP_STOPS:
                coord_str = ";".join(f"{lon},{lat}" for lon, lat in tier_coords)
                url = (
                    f"{OSRM_BASE}/trip/v1/driving/{coord_str}"
                    "?roundtrip=false&source=first&geometries=geojson&overview=full"
                )

                async with httpx.AsyncClient(timeout=12.0) as client:
                    resp = await client.get(url)
                    data = resp.json()

                if data.get("code") != "Ok" or not data.get("trips"):
                    raise ValueError(f"OSRM trip code={data.get('code')}")

                trip = data["trips"][0]
                all_geometries.append(trip["geometry"])
                total_distance_m += trip["distance"]
                total_duration_s += trip["duration"]

                waypoints = data.get("waypoints", [])
                stop_wps  = waypoints[1:]  # skip cur_pos waypoint
                if len(stop_wps) == len(t_stops):
                    ordered_idx   = sorted(
                        range(len(t_stops)),
                        key=lambda i: stop_wps[i].get("waypoint_index", i),
                    )
                    reordered_ids = [t_stops[i][2] for i in ordered_idx]
                    current_ids   = [s[2] for s in t_stops]
                    if reordered_ids != current_ids:
                        reordered = True

                    # Sequence numbers are 1-based globally across all tiers
                    seq_offset = sum(
                        len(tier_stops[r]) for r in sorted(tier_stops.keys()) if r < tier_rank
                    )
                    for local_seq, pkg_id in enumerate(reordered_ids, start=1):
                        db.execute(
                            update(Assignment)
                            .where(Assignment.driver_id == driver_id)
                            .where(Assignment.package_id == pkg_id)
                            .values(sequence_number=seq_offset + local_seq)
                        )

                    last_stop = t_stops[ordered_idx[-1]]
                    cur_pos   = (last_stop[0], last_stop[1])
                else:
                    cur_pos = (t_stops[-1][0], t_stops[-1][1])

            else:
                # Too many stops for /trip — sample waypoints for /route
                full_path = tier_coords + [tier_coords[-1]]
                step      = max(len(full_path) // 99, 1)
                sampled   = full_path[::step]
                if sampled[-1] != full_path[-1]:
                    sampled.append(full_path[-1])
                coord_str = ";".join(f"{lon},{lat}" for lon, lat in sampled)
                url = f"{OSRM_BASE}/route/v1/driving/{coord_str}?overview=full&geometries=geojson"

                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.get(url)
                    data = resp.json()

                if data.get("code") != "Ok" or not data.get("routes"):
                    raise ValueError(f"OSRM route code={data.get('code')}")

                route = data["routes"][0]
                all_geometries.append(route["geometry"])
                total_distance_m += route["distance"]
                total_duration_s += route["duration"]
                cur_pos = (t_stops[-1][0], t_stops[-1][1])

        db.commit()

    except Exception:
        source = "straight"
        full_path = [depot] + [(r.lon, r.lat) for r in rows]
        all_geometries = [_straight_line_geometry(full_path)]
        total_duration_s = float(len(rows) * 3 * 60)

    merged_geometry  = _merge_geojson_lines(all_geometries) if all_geometries else None
    distance_km      = round(total_distance_m / 1000, 1)
    drive_min        = round(total_duration_s / 60, 0)
    est_delivery_min = round(drive_min + len(rows) * 5, 0)

    return {
        "type": "Feature",
        "geometry": merged_geometry,
        "properties": {
            "driver_id":          driver_id,
            "driver_name":        f"{driver.first_name} {driver.last_name}",
            "zone":               driver.zone_mestska_cast,
            "packages":           len(rows),
            "distance_km":        distance_km,
            "drive_duration_min": drive_min,
            "est_delivery_min":   est_delivery_min,
            "source":             source,
            "reordered":          reordered,
        },
    }
