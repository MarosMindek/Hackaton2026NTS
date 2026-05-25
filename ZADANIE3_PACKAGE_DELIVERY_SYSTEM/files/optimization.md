A — Cross-zone overflow (optimizer.py, ~30 lines)
After Phase 1, collect unassigned packages. For each, find the geographically nearest driver with remaining capacity. Priority-aware: Overnight/Expres overflow to any driver; Štandard/Ekonomický capped to drivers within 8 km of the package. This alone should eliminate most unassigned packages.

B — Best-fit instead of first-fit (optimizer.py, ~5 lines)
Instead of "first driver that fits", pick "driver where max(remaining_weight_pct, remaining_volume_pct) is smallest" — fills bins tighter, leaves larger drivers available for bigger packages.

C — Combined weight+volume sort key (optimizer.py, 1 line)
Sort packages by max(weight_kg / avg_driver_weight, volume_m3 / avg_driver_volume) descending — biggest combined burden first.

D — Per-tier OSRM routing (routes.py, ~20 lines)
Call OSRM /trip once per priority tier instead of all stops at once. Each tier starts where the previous tier ended. Priority order guaranteed, road-optimal within each tier.