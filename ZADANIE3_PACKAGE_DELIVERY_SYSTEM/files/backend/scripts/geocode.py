"""
Google-first one-time geocoding script for KE-Delivery.

Run from repo root:

    $env:GOOGLE_MAPS_API_KEY="YOUR_KEY"
    python backend/scripts/geocode.py

Reads:
    backend/data/packages.csv

Writes:
    backend/data/geocoded.json
    backend/data/geocode_report.json

Output example:

{
  "766": {
    "lat": 48.628678,
    "lon": 21.171903,
    "status": "ZONE_FALLBACK",
    "source": "zone_centroid",
    "quality": "fallback",
    "score": 0,
    "query": null,
    "matched": "Šaca centroid"
  }
}

Important:
- The script always produces coordinates for every package.
- Google is tried first. The CSV district is intentionally IGNORED during scoring —
  the address is located by street name and house number alone, anywhere in Košice.
  A package listed under the wrong district still gets correct real-world coordinates.
- District assignment is handled by the backend using ArcGIS polygon data.
  Run "Fix districts" (or enable it permanently in seed.py) after importing geocoded.json.
- If Google returns no usable result, the script falls back to the CSV district centroid.
"""

from __future__ import annotations

import csv
import json
import math
import os
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
# Google config
# ─────────────────────────────────────────────────────────────────────────────

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

GOOGLE_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"

# Small delay to avoid hammering the API.
DELAY_SECONDS = 0.15

MAX_RETRIES = 3
REQUEST_TIMEOUT_SECONDS = 15

# If True, old fallback results are retried.
RETRY_FALLBACKS = True

# If True, old Photon/legacy results are retried with Google.
# Good when you are switching from Photon to Google.
RETRY_NON_GOOGLE_RESULTS = True

# If True, existing successful Google results are kept.
KEEP_GOOGLE_RESULTS = True


# ─────────────────────────────────────────────────────────────────────────────
# Košice geography
# ─────────────────────────────────────────────────────────────────────────────

# Košice bounding box:
# lon_min, lat_min, lon_max, lat_max
KOSICE_BBOX = (21.05, 48.55, 21.45, 48.82)

KOSICE_CENTER_LAT = 48.7164
KOSICE_CENTER_LON = 21.2611

# Approximate district centers.
# Replace later with real polygon centroids if you load district GeoJSON.
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
    house_main: str | None
    city: str
    district: str


@dataclass(frozen=True)
class QueryAttempt:
    label: str
    address: str


@dataclass(frozen=True)
class Candidate:
    lat: float
    lon: float
    score: int
    status: str
    quality: str
    source: str
    query_label: str
    matched: str
    location_type: str
    partial_match: bool
    raw_result: dict[str, Any]


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
    street_part = cleaned.split(",", 1)[0].strip()

    # Examples:
    # "Kyjevská 52/26"
    # "Južná trieda 13/16"
    # "Trieda SNP 62/6"
    # "Sácka 100/24"
    match = re.match(
        r"^(?P<street>.+?)\s+(?P<house>\d+[A-Za-zÁ-ž]?(?:/\d+[A-Za-zÁ-ž]?)?)$",
        street_part,
    )

    if match:
        street = match.group("street").strip()
        house_number = match.group("house").strip()
        house_main = house_number.split("/", 1)[0].strip()
    else:
        street = street_part
        house_number = None
        house_main = None

    return ParsedAddress(
        raw=raw,
        cleaned=cleaned,
        street_part=street_part,
        street=street,
        house_number=house_number,
        house_main=house_main,
        city="Košice",
        district=district.strip(),
    )


def _components_text(result: dict[str, Any]) -> str:
    parts: list[str] = []

    formatted = result.get("formatted_address")
    if formatted:
        parts.append(str(formatted))

    for comp in result.get("address_components", []):
        long_name = comp.get("long_name")
        short_name = comp.get("short_name")

        if long_name:
            parts.append(str(long_name))
        if short_name:
            parts.append(str(short_name))

    return " ".join(parts)


def _formatted_match(result: dict[str, Any]) -> str:
    return str(result.get("formatted_address") or "")


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


def _fallback_location(district: str) -> tuple[float, float]:
    """Return the district center as the fallback location (no jitter)."""
    return _zone_center(district)


# ─────────────────────────────────────────────────────────────────────────────
# Google request helpers
# ─────────────────────────────────────────────────────────────────────────────

_last_request_at = 0.0


def _throttle() -> None:
    global _last_request_at

    now = time.monotonic()
    elapsed = now - _last_request_at

    if elapsed < DELAY_SECONDS:
        time.sleep(DELAY_SECONDS - elapsed)

    _last_request_at = time.monotonic()


def _google_request(address: str) -> dict[str, Any] | None:
    if not GOOGLE_MAPS_API_KEY:
        raise RuntimeError(
            "Missing GOOGLE_MAPS_API_KEY environment variable. "
            "Set it before running the script."
        )

    lon_min, lat_min, lon_max, lat_max = KOSICE_BBOX

    params = {
        "address": address,
        "region": "sk",
        "language": "sk",
        "components": "country:SK",
        "bounds": f"{lat_min},{lon_min}|{lat_max},{lon_max}",
        "key": GOOGLE_MAPS_API_KEY,
    }

    url = f"{GOOGLE_GEOCODE_URL}?{urllib.parse.urlencode(params)}"

    for attempt in range(1, MAX_RETRIES + 1):
        _throttle()

        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "KE-Delivery-geocoder/1.0",
                "Accept": "application/json",
            },
        )

        try:
            with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SECONDS) as resp:
                data = json.loads(resp.read().decode("utf-8"))

            status = data.get("status")

            if status == "OK":
                return data

            if status == "ZERO_RESULTS":
                return data

            if status in {"OVER_QUERY_LIMIT", "UNKNOWN_ERROR"} and attempt < MAX_RETRIES:
                print(f"    Google {status}, retry {attempt}/{MAX_RETRIES}")
                time.sleep(2 * attempt)
                continue

            if status in {"REQUEST_DENIED", "INVALID_REQUEST"}:
                msg = data.get("error_message", "")
                raise RuntimeError(f"Google geocoding failed: {status} {msg}")

            print(f"    Google status {status}: {data.get('error_message', '')}")
            return data

        except urllib.error.HTTPError as exc:
            body = ""
            try:
                body = exc.read().decode("utf-8", errors="replace")[:200]
            except Exception:
                pass

            print(f"    HTTP {exc.code}, attempt {attempt}/{MAX_RETRIES}: {body}")

            if attempt < MAX_RETRIES:
                time.sleep(2 * attempt)
                continue

            return None

        except Exception as exc:
            # Let config/auth errors stop the script.
            if "REQUEST_DENIED" in str(exc) or "INVALID_REQUEST" in str(exc):
                raise

            print(f"    request error, attempt {attempt}/{MAX_RETRIES}: {exc}")

            if attempt < MAX_RETRIES:
                time.sleep(2 * attempt)
                continue

            return None

    return None


# ─────────────────────────────────────────────────────────────────────────────
# Query attempts and scoring
# ─────────────────────────────────────────────────────────────────────────────

def _build_attempts(addr: ParsedAddress) -> list[QueryAttempt]:
    attempts: list[QueryAttempt] = []

    # 1. Full address as it appears after removing district suffix.
    attempts.append(QueryAttempt(
        label="full_cleaned",
        address=f"{addr.cleaned}, Slovensko",
    ))

    # 2. Full street part.
    attempts.append(QueryAttempt(
        label="street_part_full",
        address=f"{addr.street_part}, Košice, Slovensko",
    ))

    # 3. Main house number only.
    # For addresses like 52/26, Google may understand 52 better than 52/26.
    if addr.house_main and addr.house_main != addr.house_number:
        attempts.append(QueryAttempt(
            label="street_main_house",
            address=f"{addr.street} {addr.house_main}, Košice, Slovensko",
        ))

    # 4. Street only (no district — district in CSV may be wrong).
    attempts.append(QueryAttempt(
        label="street_only",
        address=f"{addr.street}, Košice, Slovensko",
    ))

    # 5. District fallback — low priority, scored down heavily.
    attempts.append(QueryAttempt(
        label="district_only",
        address=f"{addr.district}, Košice, Slovensko",
    ))

    return attempts


def _score_google_result(
    result: dict[str, Any],
    addr: ParsedAddress,
    query_label: str,
) -> Candidate | None:
    geometry = result.get("geometry") or {}
    location = geometry.get("location") or {}

    try:
        lat = float(location["lat"])
        lon = float(location["lng"])
    except Exception:
        return None

    if not _in_kosice(lat, lon):
        return None

    text = _normalize_text(_components_text(result))

    street_norm = _normalize_text(addr.street)
    city_norm = _normalize_text(addr.city)
    house_full = _normalize_text(addr.house_number)
    house_main = _normalize_text(addr.house_main)

    street_match = bool(street_norm and street_norm in text)
    city_match = bool(city_norm and city_norm in text)

    house_match = False
    if house_full and house_full in text:
        house_match = True
    elif house_main and len(house_main) >= 2 and house_main in text:
        house_match = True

    location_type = str(geometry.get("location_type") or "")
    partial_match = bool(result.get("partial_match", False))

    # Reward results that stay inside Košice — penalise drifting far from centre.
    # We deliberately do NOT use the CSV district centroid here: the district in
    # the CSV may be wrong, and we want the real address coordinates regardless.
    distance_from_center_km = _haversine_km(lat, lon, KOSICE_CENTER_LAT, KOSICE_CENTER_LON)

    score = 0

    # Basic safety: result is inside Košice bbox.
    score += 35

    if city_match:
        score += 20

    if street_match:
        score += 45

    if house_match:
        score += 35

    # Google location type quality.
    if location_type == "ROOFTOP":
        score += 35
    elif location_type == "RANGE_INTERPOLATED":
        score += 25
    elif location_type == "GEOMETRIC_CENTER":
        score += 10
    elif location_type == "APPROXIMATE":
        score -= 5

    if partial_match:
        score -= 15

    # Reward proximity to Košice centre — anything inside the city limits is fine.
    if distance_from_center_km <= 5:
        score += 15
    elif distance_from_center_km <= 10:
        score += 8
    elif distance_from_center_km <= 15:
        score += 3
    else:
        score -= min(int(distance_from_center_km - 15), 20)

    # Query attempt quality.
    if query_label in {"full_cleaned", "street_part_full", "street_main_house"}:
        score += 10
    elif query_label == "street_only":
        score += 3
    elif query_label == "district_only":
        score -= 25

    # Classification.
    if street_match and house_match and location_type in {"ROOFTOP", "RANGE_INTERPOLATED"}:
        status = "GEOCODED_ADDRESS"
        quality = "high"
    elif street_match and house_match:
        status = "GEOCODED_ADDRESS_APPROX"
        quality = "medium"
    elif street_match:
        status = "GEOCODED_STREET"
        quality = "medium"
    else:
        status = "GEOCODED_APPROXIMATE"
        quality = "low"

    return Candidate(
        lat=lat,
        lon=lon,
        score=score,
        status=status,
        quality=quality,
        source="google",
        query_label=query_label,
        matched=_formatted_match(result),
        location_type=location_type,
        partial_match=partial_match,
        raw_result=result,
    )


def _acceptable(candidate: Candidate) -> bool:
    """
    Decide if a Google result is good enough to use as a real-ish point.

    District-only and weak approximate results are rejected.
    For those, zone fallback is more honest.
    """
    if candidate.status == "GEOCODED_ADDRESS":
        return candidate.score >= 85

    if candidate.status == "GEOCODED_ADDRESS_APPROX":
        return candidate.score >= 80

    if candidate.status == "GEOCODED_STREET":
        return candidate.score >= 70

    # Do not accept district-only as a real route coordinate.
    return False


def _geocode_with_google(addr: ParsedAddress) -> Candidate | None:
    best: Candidate | None = None

    for attempt in _build_attempts(addr):
        data = _google_request(attempt.address)

        if not data:
            continue

        results = data.get("results") or []

        for result in results:
            candidate = _score_google_result(result, addr, attempt.label)

            if not candidate:
                continue

            if best is None or candidate.score > best.score:
                best = candidate

        # Early stop for strong exact result.
        if best and best.status == "GEOCODED_ADDRESS" and best.score >= 125:
            return best

        # Early stop for strong address approximate result.
        if best and best.status == "GEOCODED_ADDRESS_APPROX" and best.score >= 115:
            return best

    if best and _acceptable(best):
        return best

    return None


# ─────────────────────────────────────────────────────────────────────────────
# Result helpers
# ─────────────────────────────────────────────────────────────────────────────

def _make_google_result(candidate: Candidate) -> dict[str, Any]:
    return {
        "lat": candidate.lat,
        "lon": candidate.lon,
        "status": candidate.status,
        "source": "google",
        "quality": candidate.quality,
        "score": candidate.score,
        "query": candidate.query_label,
        "matched": candidate.matched,
        "location_type": candidate.location_type,
        "partial_match": candidate.partial_match,
    }


def _make_fallback_result(district: str) -> dict[str, Any]:
    lat, lon = _fallback_location(district)

    return {
        "lat": lat,
        "lon": lon,
        "status": "ZONE_FALLBACK",
        "source": "zone_centroid",
        "quality": "fallback",
        "score": 0,
        "query": None,
        "matched": f"{district} centroid",
        "location_type": None,
        "partial_match": None,
    }


def _should_skip_existing(existing_result: dict[str, Any]) -> bool:
    if "lat" not in existing_result or "lon" not in existing_result:
        return False

    source = existing_result.get("source")
    status = existing_result.get("status")

    if source == "google" and status != "ZONE_FALLBACK":
        return KEEP_GOOGLE_RESULTS

    if status == "ZONE_FALLBACK":
        return not RETRY_FALLBACKS

    if source != "google":
        return not RETRY_NON_GOOGLE_RESULTS

    return False


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


def _summarize(results: dict[str, dict[str, Any]], total_rows: int) -> dict[str, Any]:
    status_counts: dict[str, int] = {}
    source_counts: dict[str, int] = {}
    quality_counts: dict[str, int] = {}

    for result in results.values():
        status = str(result.get("status", "LEGACY_UNKNOWN"))
        source = str(result.get("source", "unknown"))
        quality = str(result.get("quality", "unknown"))

        status_counts[status] = status_counts.get(status, 0) + 1
        source_counts[source] = source_counts.get(source, 0) + 1
        quality_counts[quality] = quality_counts.get(quality, 0) + 1

    google_count = source_counts.get("google", 0)
    fallback_count = status_counts.get("ZONE_FALLBACK", 0)

    return {
        "total_packages": total_rows,
        "total_results": len(results),
        "google_count": google_count,
        "fallback_count": fallback_count,
        "status_counts": dict(sorted(status_counts.items())),
        "source_counts": dict(sorted(source_counts.items())),
        "quality_counts": dict(sorted(quality_counts.items())),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    if not GOOGLE_MAPS_API_KEY:
        raise RuntimeError(
            "Missing GOOGLE_MAPS_API_KEY. In PowerShell, run:\n"
            '$env:GOOGLE_MAPS_API_KEY="YOUR_KEY"'
        )

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
    print(f"Retry non-Google results: {RETRY_NON_GOOGLE_RESULTS}")
    print()

    processed = 0
    skipped = 0
    google_ok = 0
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

        candidate = _geocode_with_google(parsed)

        if candidate:
            result = _make_google_result(candidate)
            results[package_id] = result
            google_ok += 1

            print(
                f"→ {result['status']} "
                f"{result['lat']:.6f}, {result['lon']:.6f} "
                f"score={result['score']} "
                f"type={result['location_type']} "
                f"via={result['query']}"
            )
        else:
            result = _make_fallback_result(district)
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

    _save_json(OUT_FILE, results)

    report = _summarize(results, len(rows))
    _save_json(REPORT_FILE, report)

    print()
    print("Done.")
    print(f"Skipped existing successful results: {skipped}")
    print(f"Processed this run: {processed}")
    print(f"Google geocoded this run: {google_ok}")
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