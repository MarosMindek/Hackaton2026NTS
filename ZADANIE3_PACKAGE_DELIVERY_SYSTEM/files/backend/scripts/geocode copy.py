"""
One-time geocoding script for KE-Delivery.

Uses Photon public API:
    https://photon.komoot.io

Run from repo root:
    python backend/scripts/geocode.py

Reads:
    backend/data/packages.csv

Writes:
    backend/data/geocoded.json
    backend/data/geocode_report.json

Result format:
    {
      "1": {
        "lat": 48.730123,
        "lon": 21.299456,
        "status": "GEOCODED_ADDRESS",
        "source": "photon",
        "score": 138,
        "query": "structured_full",
        "matched": "Cottbuská 71, Košice, Slovensko"
      },
      "2": {
        "lat": 48.687912,
        "lon": 21.181731,
        "status": "ZONE_FALLBACK",
        "source": "zone_centroid",
        "score": 0,
        "query": null,
        "matched": "Lorinčík centroid + jitter"
      }
    }

Important:
- The script always writes coordinates for every package.
- If Photon cannot find a good match, it falls back to district center + deterministic jitter.
- Existing successful geocodes are reused, so the script can be resumed.
- Existing fallback results can be retried by setting RETRY_FALLBACKS = True.
"""

from __future__ import annotations

import csv
import hashlib
import json
import math
import random
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any


# ─────────────────────────────────────────────────────────────────────────────
# Paths
# ─────────────────────────────────────────────────────────────────────────────

DATA_DIR = Path(__file__).parent.parent / "data"
CSV_FILE = DATA_DIR / "packages.csv"
OUT_FILE = DATA_DIR / "geocoded.json"
REPORT_FILE = DATA_DIR / "geocode_report.json"


# ─────────────────────────────────────────────────────────────────────────────
# Photon config
# ─────────────────────────────────────────────────────────────────────────────

PHOTON_BASE_URL = "https://photon.komoot.io"

# The public Photon server can throttle heavy usage.
# Use 1.0 for polite public API use.
# If you later run your own local Photon instance, you can lower this.
DELAY_SECONDS = 1.0

MAX_RETRIES = 3
REQUEST_TIMEOUT_SECONDS = 15

USER_AGENT = "KE-Delivery-geocoder/1.0 (hackathon demo; contact: local)"

# Košice bounding box.
# Photon bbox format is:
#   minLon,minLat,maxLon,maxLat
KOSICE_BBOX = (21.05, 48.55, 21.45, 48.82)

# Bias searches toward Košice center.
KOSICE_CENTER_LAT = 48.7164
KOSICE_CENTER_LON = 21.2611

# If True, packages that already have ZONE_FALLBACK will be tried again.
# Useful after you improve the script.
RETRY_FALLBACKS = True

# If True, old records that only contain lat/lon and no status are kept.
KEEP_LEGACY_RESULTS = True


# ─────────────────────────────────────────────────────────────────────────────
# Approximate city-district centers
# Used for fallback and for scoring Photon results.
#
# These do not need to be perfect. They are fallback/display coordinates.
# If you later get official district polygons/centroids, replace these values.
# ─────────────────────────────────────────────────────────────────────────────

ZONE_CENTERS: dict[str, tuple[float, float]] = {
    "Staré Mesto": (48.7210, 21.2570),
    "Sídlisko KVP": (48.7040, 21.2070),
    "Sídlisko Ťahanovce": (48.7520, 21.2540),
    "Dargovských hrdinov": (48.7330, 21.2920),
    "Nad jazerom": (48.6950, 21.2840),
    "Západ": (48.7140, 21.2290),
    "Juh": (48.6990, 21.2590),
    "Sever": (48.7460, 21.2490),
    "Kavečany": (48.7750, 21.2040),
    "Košická Nová Ves": (48.7370, 21.3270),
    "Šaca": (48.6360, 21.1690),
    "Barca": (48.6730, 21.2680),
    "Poľov": (48.6490, 21.2400),
    "Lorinčík": (48.6870, 21.1820),
    "Myslava": (48.7000, 21.1960),
    "Pereš": (48.6760, 21.1980),
    "Vyšné Opátske": (48.6910, 21.3090),
    "Krásna": (48.6700, 21.3270),
}


# ─────────────────────────────────────────────────────────────────────────────
# Data classes
# ─────────────────────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class ParsedAddress:
    raw: str
    cleaned: str
    street_part: str
    street: str
    house_number: str | None
    city: str
    district: str


@dataclass(frozen=True)
class QueryAttempt:
    label: str
    endpoint: str
    params: dict[str, Any]


@dataclass(frozen=True)
class Candidate:
    lat: float
    lon: float
    score: int
    status: str
    query_label: str
    matched: str
    properties: dict[str, Any]


# ─────────────────────────────────────────────────────────────────────────────
# Text helpers
# ─────────────────────────────────────────────────────────────────────────────

def _normalize_text(value: str | None) -> str:
    if not value:
        return ""

    value = value.lower().strip()
    value = unicodedata.normalize("NFKD", value)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = re.sub(r"[^a-z0-9]+", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def _zone_key(value: str | None) -> str:
    return _normalize_text(value)


NORMALIZED_ZONE_CENTERS = {
    _zone_key(name): coords for name, coords in ZONE_CENTERS.items()
}


def _clean_address(raw: str) -> str:
    """
    "Cottbuská 71, Košice - Dargovských hrdinov"
    -> "Cottbuská 71, Košice"
    """
    part = raw.split(" - ")[0].strip()

    if "košice" not in part.lower() and "kosice" not in _normalize_text(part):
        part += ", Košice"

    return part


def _parse_address(raw: str, district: str) -> ParsedAddress:
    cleaned = _clean_address(raw)

    # Everything before the first comma should be "street + house number".
    street_part = cleaned.split(",", 1)[0].strip()

    # Supports:
    #   "Cottbuská 71"
    #   "Údolná 115/1"
    #   "Južná trieda 13/16"
    #   "Trieda SNP 62/6"
    match = re.match(
        r"^(?P<street>.+?)\s+(?P<house>\d+[A-Za-zÁ-ž]?(?:/\d+[A-Za-zÁ-ž]?)?)$",
        street_part,
    )

    if match:
        street = match.group("street").strip()
        house_number = match.group("house").strip()
    else:
        street = street_part
        house_number = None

    return ParsedAddress(
        raw=raw,
        cleaned=cleaned,
        street_part=street_part,
        street=street,
        house_number=house_number,
        city="Košice",
        district=district.strip(),
    )


def _feature_text(properties: dict[str, Any]) -> str:
    useful_keys = [
        "name",
        "street",
        "housenumber",
        "city",
        "district",
        "postcode",
        "country",
        "countrycode",
        "osm_key",
        "osm_value",
    ]

    parts = []
    for key in useful_keys:
        value = properties.get(key)
        if value is not None:
            parts.append(str(value))

    return " ".join(parts)


def _feature_label(properties: dict[str, Any]) -> str:
    parts = []

    for key in ["name", "housenumber", "street", "city", "district", "country"]:
        value = properties.get(key)
        if value:
            parts.append(str(value))

    return ", ".join(parts) if parts else json.dumps(properties, ensure_ascii=False)[:120]


# ─────────────────────────────────────────────────────────────────────────────
# Geometry helpers
# ─────────────────────────────────────────────────────────────────────────────

def _in_kosice(lat: float, lon: float) -> bool:
    lon_min, lat_min, lon_max, lat_max = KOSICE_BBOX
    return lat_min <= lat <= lat_max and lon_min <= lon <= lon_max


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius_km = 6371.0

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )

    return 2 * radius_km * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _zone_center(district: str) -> tuple[float, float]:
    return NORMALIZED_ZONE_CENTERS.get(
        _zone_key(district),
        (KOSICE_CENTER_LAT, KOSICE_CENTER_LON),
    )


def _fallback_location(package_id: str, district: str) -> tuple[float, float]:
    """
    Returns deterministic fake coordinates near the district center.

    Deterministic means:
    - package 123 always gets the same fallback point
    - no random movement every script run
    """
    center_lat, center_lon = _zone_center(district)

    seed = int(hashlib.sha256(f"{package_id}:{district}".encode("utf-8")).hexdigest()[:16], 16)
    rng = random.Random(seed)

    # Radius around the zone center.
    # 0.003–0.010 degrees is roughly a few hundred meters.
    radius = rng.uniform(0.0025, 0.0090)
    angle = rng.uniform(0, 2 * math.pi)

    lat_offset = math.sin(angle) * radius

    # Longitude degrees are "smaller" by latitude, so adjust a little.
    lon_offset = math.cos(angle) * radius / max(math.cos(math.radians(center_lat)), 0.2)

    lat = center_lat + lat_offset
    lon = center_lon + lon_offset

    # Safety clamp into Košice bbox.
    lon_min, lat_min, lon_max, lat_max = KOSICE_BBOX
    lat = min(max(lat, lat_min), lat_max)
    lon = min(max(lon, lon_min), lon_max)

    return round(lat, 6), round(lon, 6)


# ─────────────────────────────────────────────────────────────────────────────
# Photon request helpers
# ─────────────────────────────────────────────────────────────────────────────

_last_request_at = 0.0


def _throttle() -> None:
    global _last_request_at

    now = time.monotonic()
    elapsed = now - _last_request_at

    if elapsed < DELAY_SECONDS:
        time.sleep(DELAY_SECONDS - elapsed)

    _last_request_at = time.monotonic()


def _photon_request(endpoint: str, params: dict[str, Any]) -> dict[str, Any] | None:
    """
    Calls Photon and returns parsed JSON.

    endpoint:
      "api"
      "structured"
    """
    cleaned_params = {
        key: value
        for key, value in params.items()
        if value is not None and value != ""
    }

    query = urllib.parse.urlencode(cleaned_params, doseq=True)
    url = f"{PHOTON_BASE_URL.rstrip('/')}/{endpoint}?{query}"

    for attempt in range(1, MAX_RETRIES + 1):
        _throttle()

        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "application/json",
            },
        )

        try:
            with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SECONDS) as resp:
                return json.loads(resp.read().decode("utf-8"))

        except urllib.error.HTTPError as exc:
            body = ""
            try:
                body = exc.read().decode("utf-8", errors="replace")[:200]
            except Exception:
                pass

            # 400 means the query was rejected. Retrying the same query will not help.
            # Keep it short so logs do not become noisy.
            if exc.code == 400:
                print(f"    structured/API query rejected with HTTP 400, skipping this attempt")
                return None

            print(f"    HTTP {exc.code} on {endpoint}, attempt {attempt}/{MAX_RETRIES}: {body}")

            # Rate limit or temporary server problem.
            if exc.code in {429, 500, 502, 503, 504} and attempt < MAX_RETRIES:
                time.sleep(2 * attempt)
                continue

            return None


# ─────────────────────────────────────────────────────────────────────────────
# Query generation and scoring
# ─────────────────────────────────────────────────────────────────────────────

def _base_params() -> dict[str, Any]:
    lon_min, lat_min, lon_max, lat_max = KOSICE_BBOX

    return {
        "limit": 10,
        "bbox": f"{lon_min},{lat_min},{lon_max},{lat_max}",
        "countrycode": "SK",
        "lat": KOSICE_CENTER_LAT,
        "lon": KOSICE_CENTER_LON,
        "zoom": 13,
        "location_bias_scale": 0.2,
    }


def _build_attempts(addr: ParsedAddress) -> list[QueryAttempt]:
    """
    Try strict searches first, then weaker searches.

    Important:
    - Free-text keeps the full house number, e.g. 52/26.
    - Structured search uses only the main house number, e.g. 52.
      This avoids Photon structured-query failures for slash-style house numbers.
    """
    base = _base_params()
    structured_house = _structured_house_number(addr.house_number)

    attempts: list[QueryAttempt] = []

    # 1. Free-text full address first.
    # This is often safer than structured for Central European house numbers.
    attempts.append(QueryAttempt(
        label="api_full_street_part",
        endpoint="api",
        params={
            **base,
            "q": f"{addr.street_part}, Košice, Slovensko",
        },
    ))

    # 2. Free-text cleaned original.
    attempts.append(QueryAttempt(
        label="api_cleaned_address",
        endpoint="api",
        params={
            **base,
            "q": f"{addr.cleaned}, Slovensko",
        },
    ))

    # 3. Structured without district.
    # District can sometimes confuse matching.
    attempts.append(QueryAttempt(
        label="structured_no_district",
        endpoint="structured",
        params={
            **base,
            "city": addr.city,
            "street": addr.street,
            "housenumber": structured_house,
            "countrycode": "SK",
        },
    ))

    # 4. Structured with district.
    attempts.append(QueryAttempt(
        label="structured_full",
        endpoint="structured",
        params={
            **base,
            "city": addr.city,
            "district": addr.district,
            "street": addr.street,
            "housenumber": structured_house,
            "countrycode": "SK",
        },
    ))

    # 5. Street-only free text with district.
    attempts.append(QueryAttempt(
        label="api_street_with_district",
        endpoint="api",
        params={
            **base,
            "q": f"{addr.street}, Košice - {addr.district}, Slovensko",
        },
    ))

    # 6. Street-only free text without district.
    attempts.append(QueryAttempt(
        label="api_street_only",
        endpoint="api",
        params={
            **base,
            "q": f"{addr.street}, Košice, Slovensko",
        },
    ))

    # 7. Structured street only.
    attempts.append(QueryAttempt(
        label="structured_street_only",
        endpoint="structured",
        params={
            **base,
            "city": addr.city,
            "street": addr.street,
            "countrycode": "SK",
        },
    ))

    # 8. District-only search.
    # This is weak. We only use it as information, not as a strong route point.
    attempts.append(QueryAttempt(
        label="api_district_only",
        endpoint="api",
        params={
            **base,
            "q": f"{addr.district}, Košice, Slovensko",
        },
    ))

    return attempts


def _score_feature(
    feature: dict[str, Any],
    addr: ParsedAddress,
    query_label: str,
) -> Candidate | None:
    geometry = feature.get("geometry") or {}
    coordinates = geometry.get("coordinates") or []

    if len(coordinates) < 2:
        return None

    lon, lat = coordinates[0], coordinates[1]

    try:
        lat = float(lat)
        lon = float(lon)
    except Exception:
        return None

    if not _in_kosice(lat, lon):
        return None

    properties: dict[str, Any] = feature.get("properties") or {}
    text = _normalize_text(_feature_text(properties))

    street_norm = _normalize_text(addr.street)
    district_norm = _normalize_text(addr.district)
    city_norm = _normalize_text(addr.city)

    house_number = addr.house_number or ""
    house_main = house_number.split("/", 1)[0] if house_number else ""

    street_match = bool(street_norm and street_norm in text)
    district_match = bool(district_norm and district_norm in text)
    city_match = bool(city_norm and city_norm in text)

    house_match = False
    if house_number:
        # Exact "115/1" or main "115".
        # Avoid accepting single-digit main numbers too easily.
        house_match = house_number in text
        if not house_match and len(house_main) >= 2:
            house_match = house_main in text

    center_lat, center_lon = _zone_center(addr.district)
    distance_from_zone_km = _haversine_km(lat, lon, center_lat, center_lon)

    score = 0

    # It passed Košice bbox.
    score += 30

    # Prefer Košice-like results.
    if city_match:
        score += 25

    # Prefer district-specific results.
    if district_match:
        score += 15

    # Strongest signal: matching street.
    if street_match:
        score += 45

    # House number is nice, but not always available in OSM.
    if house_match:
        score += 35

    # Slovakia result.
    country_code = str(properties.get("countrycode", "")).upper()
    country = _normalize_text(str(properties.get("country", "")))

    if country_code == "SK" or "slovensko" in country or "slovakia" in country:
        score += 10

    # Prefer results near the expected city district center.
    # This protects us from a correct street name in a wrong part of the city.
    if distance_from_zone_km <= 1.5:
        score += 18
    elif distance_from_zone_km <= 3:
        score += 12
    elif distance_from_zone_km <= 6:
        score += 6
    else:
        score -= min(int(distance_from_zone_km), 20)

    # Query quality hints.
    if query_label in {"structured_full", "structured_no_district"}:
        score += 12
    elif query_label in {"api_full_street_part", "api_cleaned_address"}:
        score += 8
    elif query_label in {
        "structured_street_only_with_district",
        "api_street_with_district",
        "api_street_only",
    }:
        score += 3
    elif query_label == "api_district_only":
        score -= 15

    # Classification.
    if street_match and house_match:
        status = "GEOCODED_ADDRESS"
    elif street_match:
        status = "GEOCODED_STREET"
    elif district_match:
        status = "GEOCODED_DISTRICT"
    else:
        status = "GEOCODED_APPROXIMATE"

    matched = _feature_label(properties)

    return Candidate(
        lat=round(lat, 6),
        lon=round(lon, 6),
        score=score,
        status=status,
        query_label=query_label,
        matched=matched,
        properties=properties,
    )


def _acceptable(candidate: Candidate) -> bool:
    """
    Decide whether a Photon result is better than our own zone fallback.

    For routing, district-only results are not good enough.
    If Photon only found the district, our deterministic zone fallback is usually safer
    and more honest.
    """
    if candidate.status == "GEOCODED_ADDRESS":
        return candidate.score >= 85

    if candidate.status == "GEOCODED_STREET":
        return candidate.score >= 70

    # Do not accept district-only Photon results as real geocoding.
    # The zone fallback is clearer and predictable.
    if candidate.status == "GEOCODED_DISTRICT":
        return False

    return False


def _geocode_with_photon(addr: ParsedAddress) -> Candidate | None:
    best: Candidate | None = None

    for attempt in _build_attempts(addr):
        data = _photon_request(attempt.endpoint, attempt.params)

        if not data:
            continue

        features = data.get("features") or []

        for feature in features:
            candidate = _score_feature(feature, addr, attempt.label)

            if not candidate:
                continue

            if best is None or candidate.score > best.score:
                best = candidate

        # Early stop if we already got an excellent exact result.
        if best and best.status == "GEOCODED_ADDRESS" and best.score >= 125:
            return best

        # Early stop if street-level result is strong enough.
        if best and best.status == "GEOCODED_STREET" and best.score >= 105:
            return best

    if best and _acceptable(best):
        return best

    return None


# ─────────────────────────────────────────────────────────────────────────────
# Result helpers
# ─────────────────────────────────────────────────────────────────────────────

def _make_photon_result(candidate: Candidate) -> dict[str, Any]:
    return {
        "lat": candidate.lat,
        "lon": candidate.lon,
        "status": candidate.status,
        "source": "photon",
        "score": candidate.score,
        "query": candidate.query_label,
        "matched": candidate.matched,
    }


def _make_fallback_result(package_id: str, district: str) -> dict[str, Any]:
    lat, lon = _fallback_location(package_id, district)

    return {
        "lat": lat,
        "lon": lon,
        "status": "ZONE_FALLBACK",
        "source": "zone_centroid",
        "score": 0,
        "query": None,
        "matched": f"{district} centroid + jitter",
    }


def _should_skip_existing(existing_result: dict[str, Any]) -> bool:
    """
    Keeps already successful results.

    Old file format was:
        {"lat": ..., "lon": ...}

    New file format includes:
        status/source/score/query/matched
    """
    if "lat" not in existing_result or "lon" not in existing_result:
        return False

    status = existing_result.get("status")

    if status == "ZONE_FALLBACK":
        return not RETRY_FALLBACKS

    if status is None:
        return KEEP_LEGACY_RESULTS

    return True


def _load_existing() -> dict[str, dict[str, Any]]:
    if not OUT_FILE.exists():
        return {}

    with open(OUT_FILE, encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, dict):
        raise ValueError(f"{OUT_FILE} must contain a JSON object.")

    return data


def _save_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def _structured_house_number(house_number: str | None) -> str | None:
    """
    Photon structured search can behave badly with Slovak-style numbers like 52/26.
    For structured search, use the main number only.
    Free-text search still keeps the full original address.
    """
    if not house_number:
        return None

    main = house_number.split("/", 1)[0].strip()
    return main or None

def _summarize(results: dict[str, dict[str, Any]], total_rows: int) -> dict[str, Any]:
    status_counts: dict[str, int] = {}
    source_counts: dict[str, int] = {}

    for result in results.values():
        status = str(result.get("status", "LEGACY_UNKNOWN"))
        source = str(result.get("source", "unknown"))

        status_counts[status] = status_counts.get(status, 0) + 1
        source_counts[source] = source_counts.get(source, 0) + 1

    geocoded = sum(
        count
        for status, count in status_counts.items()
        if status.startswith("GEOCODED")
    )

    fallback = status_counts.get("ZONE_FALLBACK", 0)

    return {
        "total_packages": total_rows,
        "total_results": len(results),
        "geocoded_count": geocoded,
        "fallback_count": fallback,
        "status_counts": dict(sorted(status_counts.items())),
        "source_counts": dict(sorted(source_counts.items())),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    if not CSV_FILE.exists():
        raise FileNotFoundError(f"Missing CSV file: {CSV_FILE}")

    with open(CSV_FILE, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))

    if not rows:
        raise ValueError(f"No rows found in {CSV_FILE}")

    required_columns = {"id", "address", "city_district"}
    missing = required_columns - set(rows[0].keys())

    if missing:
        raise ValueError(f"CSV is missing required columns: {sorted(missing)}")

    existing = _load_existing()
    results: dict[str, dict[str, Any]] = dict(existing)

    print(f"Loaded {len(rows)} packages.")
    print(f"Existing geocoded.json entries: {len(existing)}")
    print(f"Retry fallbacks: {RETRY_FALLBACKS}")
    print()

    processed = 0
    skipped = 0
    photon_ok = 0
    fallback_count = 0

    for index, row in enumerate(rows, start=1):
        package_id = str(row["id"]).strip()
        raw_address = row["address"].strip()
        district = row["city_district"].strip()

        existing_result = results.get(package_id)

        if existing_result and _should_skip_existing(existing_result):
            skipped += 1
            continue

        parsed = _parse_address(raw_address, district)

        print(
            f"[{index}/{len(rows)}] #{package_id} "
            f"{parsed.street_part}, Košice - {district}",
            end="  ",
            flush=True,
        )

        candidate = _geocode_with_photon(parsed)

        if candidate:
            result = _make_photon_result(candidate)
            results[package_id] = result
            photon_ok += 1

            print(
                f"→ {result['status']} "
                f"{result['lat']:.6f}, {result['lon']:.6f} "
                f"score={result['score']} "
                f"via={result['query']}"
            )
        else:
            result = _make_fallback_result(package_id, district)
            results[package_id] = result
            fallback_count += 1

            print(
                f"→ ZONE_FALLBACK "
                f"{result['lat']:.6f}, {result['lon']:.6f}"
            )

        processed += 1

        # Save often so interruption does not lose work.
        if processed % 25 == 0:
            _save_json(OUT_FILE, results)

            report = _summarize(results, len(rows))
            _save_json(REPORT_FILE, report)

            print(f"    saved progress: {len(results)} / {len(rows)}")

    # Final save.
    _save_json(OUT_FILE, results)

    report = _summarize(results, len(rows))
    _save_json(REPORT_FILE, report)

    print()
    print("Done.")
    print(f"Skipped existing successful results: {skipped}")
    print(f"Processed this run: {processed}")
    print(f"Photon geocoded this run: {photon_ok}")
    print(f"Fallback this run: {fallback_count}")
    print()
    print("Final report:")
    print(json.dumps(report, indent=2, ensure_ascii=False))
    print()
    print(f"Wrote: {OUT_FILE}")
    print(f"Wrote: {REPORT_FILE}")
    print()
    print("Next step:")
    print("  docker compose up --build backend")


if __name__ == "__main__":
    main()