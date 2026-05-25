from fastapi import APIRouter, HTTPException

from app.zones import get_zones_geojson

router = APIRouter(prefix="/zones", tags=["zones"])


@router.get("/geojson")
def zones_geojson_endpoint() -> dict:
    """Return Košice district polygons (GeoJSON). Loaded once from ArcGIS at startup."""
    gj = get_zones_geojson()
    if gj is None:
        raise HTTPException(status_code=502, detail="ArcGIS polygon data unavailable")
    return gj
