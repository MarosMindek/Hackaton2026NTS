from pydantic import BaseModel, ConfigDict


class DriverRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    driver_id:          str
    first_name:         str
    last_name:          str
    phone:              str
    vehicle_id:         str
    vehicle_make_model: str
    vehicle_type:       str
    license_plate:      str
    max_weight_kg:      float
    max_volume_m3:      float
    max_packages_count: int
    zone_mestska_cast:  str
    years_experience:   int
    shift_start:        str
    shift_end:          str
    lat:                float
    lon:                float


class PackageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:                   int
    barcode:              str
    recipient_name:       str
    address:              str
    city_district:        str
    package_type:         str
    size:                 str
    weight_kg:            float
    volume_m3:            float
    fragile:              bool
    priority:             str
    payment_method:       str
    cod_amount_eur:       float | None
    insurance_value_eur:  float | None
    special_instructions: str | None
    status:               str
    geocode_status:       str | None
    lat:                  float
    lon:                  float


class AssignmentRead(BaseModel):
    id:                   int
    driver_id:            str
    first_name:           str
    last_name:            str
    zone:                 str
    vehicle_type:         str
    license_plate:        str
    package_id:           int
    barcode:              str
    recipient_name:       str
    address:              str
    city_district:        str
    weight_kg:            float
    volume_m3:            float
    dimensions_cm:        str | None
    priority:             str
    fragile:              bool
    geocode_status:       str | None
    lat:                  float
    lon:                  float
    sequence_number:      int
    special_instructions: str | None


class ZoneStat(BaseModel):
    zone:                   str
    total_packages:         int
    assigned:               int
    unassigned:             int
    drivers:                int
    capacity_weight_kg:     float
    used_weight_kg:         float
    weight_utilization_pct: float
    capacity_volume_m3:     float
    used_volume_m3:         float
    volume_utilization_pct: float


class DriverStat(BaseModel):
    driver_id:              str
    first_name:             str
    last_name:              str
    zone_mestska_cast:      str
    vehicle_type:           str
    vehicle_make_model:     str
    license_plate:          str
    max_weight_kg:          float
    max_volume_m3:          float
    max_packages_count:     int
    assigned_packages:      int
    assigned_weight_kg:     float
    assigned_volume_m3:     float
    weight_utilization_pct: float
    volume_utilization_pct: float
    count_utilization_pct:  float
    lat:                    float
    lon:                    float


class StatsResponse(BaseModel):
    total_packages:  int
    assigned:        int
    unassigned:      int
    unresolved:      int
    zones:           list[ZoneStat]
    drivers:         list[DriverStat]


class OptimizeResult(BaseModel):
    assigned:          int
    unassigned:        int
    unresolved:        int = 0
    overflow_assigned: int = 0
    zones_processed:   int
    districts_fixed:   int
    summary:           list[dict]
