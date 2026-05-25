import math
from collections import defaultdict

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import Assignment, Driver, Package

PRIORITY_RANK: dict[str, int] = {
    "Overnight":   0,
    "Expres":      1,
    "Štandard":    2,
    "Ekonomický":  3,
}


# ── Route geometry helpers ────────────────────────────────────────────────────

def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6_371.0
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    dφ = math.radians(lat2 - lat1)
    dλ = math.radians(lon2 - lon1)
    a = math.sin(dφ / 2) ** 2 + math.cos(φ1) * math.cos(φ2) * math.sin(dλ / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _nn_route(
    start_lat: float,
    start_lon: float,
    points: list[tuple[float, float, Package]],
) -> list[tuple[float, float, Package]]:
    remaining = list(points)
    route: list[tuple[float, float, Package]] = []
    cur_lat, cur_lon = start_lat, start_lon

    while remaining:
        best_i = min(
            range(len(remaining)),
            key=lambda i: _haversine_km(cur_lat, cur_lon, remaining[i][0], remaining[i][1]),
        )
        pt = remaining.pop(best_i)
        route.append(pt)
        cur_lat, cur_lon = pt[0], pt[1]

    return route


def _two_opt(route: list[tuple[float, float, Package]]) -> list[tuple[float, float, Package]]:
    if len(route) < 4:
        return route

    best = list(route)
    improved = True
    while improved:
        improved = False
        n = len(best)
        for i in range(n - 1):
            for j in range(i + 2, n):
                old = _haversine_km(best[i][0], best[i][1], best[i + 1][0], best[i + 1][1])
                new = _haversine_km(best[i][0], best[i][1], best[j][0], best[j][1])
                if j + 1 < n:
                    old += _haversine_km(best[j][0], best[j][1], best[j + 1][0], best[j + 1][1])
                    new += _haversine_km(best[i + 1][0], best[i + 1][1], best[j + 1][0], best[j + 1][1])
                if new < old - 1e-9:
                    best[i + 1 : j + 1] = best[i + 1 : j + 1][::-1]
                    improved = True
    return best


def _optimise_route(
    depot_lat: float,
    depot_lon: float,
    pkgs: list[Package],
) -> list[Package]:
    tiers: dict[int, list[Package]] = {}
    for pkg in pkgs:
        tier = PRIORITY_RANK.get(pkg.priority, 99)
        tiers.setdefault(tier, []).append(pkg)

    ordered: list[Package] = []
    cur_lat, cur_lon = depot_lat, depot_lon

    for tier_rank in sorted(tiers.keys()):
        points = [(p.lat, p.lon, p) for p in tiers[tier_rank]]
        nn  = _nn_route(cur_lat, cur_lon, points)
        opt = _two_opt(nn)
        ordered.extend(item[2] for item in opt)
        if opt:
            cur_lat, cur_lon = opt[-1][0], opt[-1][1]

    return ordered


# ── Main optimiser ────────────────────────────────────────────────────────────

def run_optimization(db: Session) -> dict:
    db.execute(delete(Assignment))
    db.flush()

    all_packages: list[Package] = db.execute(select(Package)).scalars().all()
    drivers: list[Driver]      = db.execute(select(Driver)).scalars().all()

    # Packages whose coordinates fall outside all district polygons cannot be
    # routed — treat them as unresolved and skip them entirely.
    UNROUTABLE = {"fallback", "out_of_district"}
    packages        = [p for p in all_packages if p.geocode_status not in UNROUTABLE]
    unresolved_count = len(all_packages) - len(packages)

    if not packages or not drivers:
        return {
            "assigned": 0, "unassigned": len(packages),
            "unresolved": unresolved_count,
            "overflow_assigned": 0,
            "zones_processed": 0, "districts_fixed": 0, "summary": [],
        }

    # C: Sort by priority tier first, then by the dominant dimension (weight or volume)
    #    relative to driver averages — largest packages first within each tier.
    avg_weight = sum(d.max_weight_kg for d in drivers) / len(drivers)
    avg_volume = sum(d.max_volume_m3 for d in drivers) / len(drivers)

    packages.sort(key=lambda p: (
        PRIORITY_RANK.get(p.priority, 99),
        -max(p.weight_kg / avg_weight, p.volume_m3 / avg_volume),
    ))

    pkg_map: dict[int, Package] = {p.id: p for p in packages}
    drv_map: dict[str, Driver]  = {d.driver_id: d for d in drivers}

    zone_packages: dict[str, list[Package]] = defaultdict(list)
    for pkg in packages:
        zone_packages[pkg.city_district].append(pkg)

    zone_drivers: dict[str, list[Driver]] = defaultdict(list)
    for drv in drivers:
        zone_drivers[drv.zone_mestska_cast].append(drv)

    load: dict[str, dict] = {
        drv.driver_id: {"weight": 0.0, "volume": 0.0, "count": 0}
        for drv in drivers
    }

    driver_pkg_ids: dict[str, list[int]] = defaultdict(list)
    zone_summaries: list[dict] = []

    # ── Phase 1: best-fit bin-packing per zone ────────────────────────────────
    for zone, pkgs in zone_packages.items():
        drvs = zone_drivers.get(zone, [])

        if not drvs:
            zone_summaries.append({
                "zone": zone, "drivers": 0,
                "assigned": 0, "unassigned": len(pkgs),
            })
            continue

        zone_assigned   = 0
        zone_unassigned = 0

        for pkg in pkgs:
            best_drv   = None
            best_score = float("inf")

            for drv in drvs:
                l = load[drv.driver_id]
                if not (
                    l["weight"] + pkg.weight_kg <= drv.max_weight_kg
                    and l["volume"] + pkg.volume_m3 <= drv.max_volume_m3
                    and l["count"] + 1            <= drv.max_packages_count
                ):
                    continue
                # Least-loaded first: pick the driver with the lowest current
                # utilisation so workload spreads proportionally across the fleet.
                util_w = l["weight"] / drv.max_weight_kg
                util_v = l["volume"] / drv.max_volume_m3
                util_c = l["count"]  / drv.max_packages_count
                score  = max(util_w, util_v, util_c)
                if score < best_score:
                    best_score = score
                    best_drv   = drv

            if best_drv:
                l = load[best_drv.driver_id]
                l["weight"] += pkg.weight_kg
                l["volume"] += pkg.volume_m3
                l["count"]  += 1
                driver_pkg_ids[best_drv.driver_id].append(pkg.id)
                zone_assigned += 1
            else:
                zone_unassigned += 1

        zone_summaries.append({
            "zone":       zone,
            "drivers":    len(drvs),
            "assigned":   zone_assigned,
            "unassigned": zone_unassigned,
        })

    total_assigned   = sum(len(ids) for ids in driver_pkg_ids.values())
    unassigned_count = len(packages) - total_assigned

    # ── Phase 2: NN + 2-opt route reordering per driver ──────────────────────
    assignments: list[Assignment] = []

    for driver_id, pkg_ids in driver_pkg_ids.items():
        drv  = drv_map[driver_id]
        pkgs = [pkg_map[pid] for pid in pkg_ids]

        ordered = _optimise_route(drv.lat, drv.lon, pkgs)

        for seq, pkg in enumerate(ordered, start=1):
            assignments.append(Assignment(
                driver_id=driver_id,
                package_id=pkg.id,
                sequence_number=seq,
            ))

    db.add_all(assignments)
    db.commit()

    return {
        "assigned":          total_assigned,
        "unassigned":        unassigned_count,
        "unresolved":        unresolved_count,
        "overflow_assigned": 0,
        "zones_processed":   len(zone_packages),
        "districts_fixed":   0,
        "summary":           sorted(zone_summaries, key=lambda x: x["zone"]),
    }
