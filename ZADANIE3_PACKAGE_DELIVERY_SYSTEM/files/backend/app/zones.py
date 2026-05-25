"""
Zone geometry utilities.

Loads real Košice district polygons from ArcGIS once at startup.
Provides:
  - get_zone_centroid(zone)            → true polygon centroid (lat, lon)
  - point_in_zone_polygon(lat, lon, zone) → point-in-polygon check
  - find_zone_for_point(lat, lon)      → which zone contains this point
  - get_zones_geojson()               → raw GeoJSON (for the /zones/geojson router)

Falls back to hardcoded approximate centroids if ArcGIS is unreachable.

ZONE_ALIASES maps alternate district names to their canonical zone name so that
merged districts (e.g. Ťahanovce → Sídlisko Ťahanovce) are handled transparently.
Both polygons are stored under the canonical name and checked together.
"""

import math
import threading

import httpx

# ---------------------------------------------------------------------------
# Static data
# ---------------------------------------------------------------------------

ZONE_COLORS: dict[str, str] = {
    "Staré Mesto":          "#6c63ff",
    "Sídlisko KVP":         "#a78bfa",
    "Sídlisko Ťahanovce":   "#ff6584",
    "Dargovských hrdinov":  "#f7971e",
    "Nad jazerom":          "#43e97b",
    "Západ":                "#38f9d7",
    "Juh":                  "#4fc3f7",
    "Sever":                "#f9a825",
    "Kavečany":             "#ef9a9a",
    "Košická Nová Ves":     "#ce93d8",
    "Šaca":                 "#80cbc4",
    "Barca":                "#ffb74d",
    "Poľov":                "#aed581",
    "Lorinčík":             "#4db6ac",
    "Myslava":              "#f48fb1",
    "Pereš":                "#81d4fa",
    "Vyšné Opátske":        "#bcaaa4",
    "Krásna":               "#ffe082",
}

# Districts that should be treated as part of a canonical zone.
# Add pairs here whenever two ArcGIS features should share one delivery zone.
ZONE_ALIASES: dict[str, str] = {
    "Ťahanovce": "Sídlisko Ťahanovce",
}

# Approximate fallback centroids — used only when ArcGIS is unreachable.
_FALLBACK_CENTROIDS: dict[str, tuple[float, float]] = {
    "Staré Mesto":          (48.7164, 21.2611),
    "Sídlisko KVP":         (48.7344, 21.2317),
    "Sídlisko Ťahanovce":   (48.7175, 21.3000),
    "Dargovských hrdinov":  (48.6844, 21.3083),
    "Nad jazerom":          (48.6944, 21.2528),
    "Západ":                (48.7378, 21.2139),
    "Juh":                  (48.6800, 21.2500),
    "Sever":                (48.7550, 21.2556),
    "Kavečany":             (48.7461, 21.3200),
    "Košická Nová Ves":     (48.7378, 21.1856),
    "Šaca":                 (48.6428, 21.2256),
    "Barca":                (48.6394, 21.2733),
    "Poľov":                (48.6683, 21.3472),
    "Lorinčík":             (48.7028, 21.3656),
    "Myslava":              (48.6928, 21.3361),
    "Pereš":                (48.6750, 21.2889),
    "Vyšné Opátske":        (48.7322, 21.3222),
    "Krásna":               (48.6633, 21.3156),
}

_ARCGIS_URL = (
    "https://services-eu1.arcgis.com/qrtO0RIRViAdEN4F/ArcGIS/rest/services/"
    "Administrat%C3%ADvne_hranice/FeatureServer/1/query"
    "?where=1%3D1"
    "&outFields=FID,NM4,VYMERA"
    "&returnGeometry=true"
    "&outSR=4326"
    "&f=geojson"
)

# ---------------------------------------------------------------------------
# Internal state (populated lazily on first use)
# ---------------------------------------------------------------------------

_lock = threading.Lock()
_loaded = False

# zone_name → list of outer rings (multiple when zones are merged via ZONE_ALIASES)
# Each ring is [[lon, lat], ...]
_zone_rings: dict[str, list[list[list[float]]]] = {}

# zone_name → (lat, lon) true polygon centroid (from the first/primary ring)
_zone_centroids: dict[str, tuple[float, float]] = {}

# Raw GeoJSON for the frontend (shared with the /zones/geojson router)
_geojson_cache: dict | None = None


# ---------------------------------------------------------------------------
# Geometry helpers (no external deps)
# ---------------------------------------------------------------------------

def _polygon_centroid(ring: list[list[float]]) -> tuple[float, float]:
    """True polygon centroid via shoelace formula. ring = [[lon, lat], ...]"""
    n = len(ring)
    if n < 3:
        lons = [p[0] for p in ring]
        lats = [p[1] for p in ring]
        return sum(lats) / n, sum(lons) / n

    area = cx = cy = 0.0
    for i in range(n):
        j = (i + 1) % n
        x0, y0 = ring[i][0], ring[i][1]
        x1, y1 = ring[j][0], ring[j][1]
        cross = x0 * y1 - x1 * y0
        area += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross

    area /= 2.0
    if abs(area) < 1e-12:
        lons = [p[0] for p in ring]
        lats = [p[1] for p in ring]
        return sum(lats) / n, sum(lons) / n

    cx /= 6.0 * area
    cy /= 6.0 * area
    return cy, cx  # (lat, lon)


def _point_in_ring(lon: float, lat: float, ring: list[list[float]]) -> bool:
    """Ray-casting point-in-polygon. ring = [[lon, lat], ...]"""
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if ((yi > lat) != (yj > lat)) and (
            lon < (xj - xi) * (lat - yi) / (yj - yi) + xi
        ):
            inside = not inside
        j = i
    return inside


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6_371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------

def _load() -> None:
    global _loaded, _zone_rings, _zone_centroids, _geojson_cache

    try:
        resp = httpx.get(_ARCGIS_URL, timeout=20.0)
        resp.raise_for_status()
        gj: dict = resp.json()
    except Exception as exc:
        print(f"[zones] ArcGIS fetch failed — falling back to approximate centroids: {exc}")
        _loaded = True
        return

    rings: dict[str, list[list[list[float]]]] = {}
    centroids: dict[str, tuple[float, float]] = {}

    for feat in gj.get("features", []):
        props = feat.get("properties") or {}
        nm4 = str(props.get("NM4") or "")
        raw_zone = nm4[7:] if nm4.startswith("Košice-") else nm4

        # Resolve alias (e.g. "Ťahanovce" → "Sídlisko Ťahanovce")
        zone = ZONE_ALIASES.get(raw_zone, raw_zone)
        if zone not in ZONE_COLORS:
            continue

        geom = feat.get("geometry") or {}
        gtype = geom.get("type", "")
        coords = geom.get("coordinates") or []

        outer: list[list[float]] | None = None
        if gtype == "Polygon" and coords:
            outer = coords[0]
        elif gtype == "MultiPolygon" and coords:
            outer = max((p[0] for p in coords if p), key=len, default=None)

        if outer and len(outer) >= 3:
            if zone not in rings:
                rings[zone] = []
                centroids[zone] = _polygon_centroid(outer)  # centroid of primary ring
            rings[zone].append(outer)

    _zone_rings = rings
    _zone_centroids = centroids
    _geojson_cache = gj
    _loaded = True

    merged = [z for z, rs in rings.items() if len(rs) > 1]
    print(
        f"[zones] Loaded {sum(len(rs) for rs in rings.values())} polygons "
        f"across {len(rings)} zones from ArcGIS."
        + (f" Merged: {merged}." if merged else "")
    )


def _ensure() -> None:
    global _loaded
    if _loaded:
        return
    with _lock:
        if not _loaded:
            _load()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_zone_centroid(zone: str) -> tuple[float, float]:
    """Return the true polygon centroid for a zone, or fallback approximate."""
    _ensure()
    canonical = ZONE_ALIASES.get(zone, zone)
    return _zone_centroids.get(canonical) or _FALLBACK_CENTROIDS.get(canonical, (48.7164, 21.2611))


def point_in_zone_polygon(lat: float, lon: float, zone: str) -> bool:
    """
    Return True if (lat, lon) is inside any polygon ring for `zone`.

    For merged zones (e.g. Sídlisko Ťahanovce + Ťahanovce) all rings are
    checked. Falls back to a 5 km haversine check if polygon data is unavailable.
    """
    _ensure()
    canonical = ZONE_ALIASES.get(zone, zone)
    ring_list = _zone_rings.get(canonical)
    if ring_list:
        return any(_point_in_ring(lon, lat, ring) for ring in ring_list)

    clat, clon = _FALLBACK_CENTROIDS.get(canonical, (48.7164, 21.2611))
    return _haversine_km(lat, lon, clat, clon) <= 5.0


def find_zone_for_point(lat: float, lon: float) -> str | None:
    """
    Return the canonical zone name whose polygon(s) contain (lat, lon), or None.

    None means the point is outside all known district polygons (e.g. a nearby
    village). In that case the caller should leave the district unchanged.
    """
    _ensure()
    for zone, ring_list in _zone_rings.items():
        if any(_point_in_ring(lon, lat, ring) for ring in ring_list):
            return zone
    return None


def get_zones_geojson() -> dict | None:
    """Return the raw ArcGIS GeoJSON (for the /zones/geojson router)."""
    _ensure()
    return _geojson_cache
