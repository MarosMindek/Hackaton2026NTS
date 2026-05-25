from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Driver(Base):
    __tablename__ = "drivers"

    driver_id:          Mapped[str]   = mapped_column(String(20), primary_key=True)
    first_name:         Mapped[str]   = mapped_column(String(100))
    last_name:          Mapped[str]   = mapped_column(String(100))
    phone:              Mapped[str]   = mapped_column(String(50))
    vehicle_id:         Mapped[str]   = mapped_column(String(20))
    vehicle_make_model: Mapped[str]   = mapped_column(String(200))
    vehicle_type:       Mapped[str]   = mapped_column(String(100))
    license_plate:      Mapped[str]   = mapped_column(String(20))
    max_weight_kg:      Mapped[float] = mapped_column(Float)
    max_volume_m3:      Mapped[float] = mapped_column(Float)
    max_packages_count: Mapped[int]   = mapped_column(Integer)
    zone_mestska_cast:  Mapped[str]   = mapped_column(String(100))
    years_experience:   Mapped[int]   = mapped_column(Integer)
    shift_start:        Mapped[str]   = mapped_column(String(10))
    shift_end:          Mapped[str]   = mapped_column(String(10))
    notes:              Mapped[str | None] = mapped_column(Text)
    lat:                Mapped[float] = mapped_column(Float)
    lon:                Mapped[float] = mapped_column(Float)


class Package(Base):
    __tablename__ = "packages"

    id:                  Mapped[int]        = mapped_column(Integer, primary_key=True)
    barcode:             Mapped[str]        = mapped_column(String(20))
    recipient_name:      Mapped[str]        = mapped_column(String(200))
    address:             Mapped[str]        = mapped_column(Text)
    city_district:       Mapped[str]        = mapped_column(String(100))
    package_type:        Mapped[str]        = mapped_column(String(100))
    size:                Mapped[str]        = mapped_column(String(10))
    dimensions_cm:       Mapped[str | None] = mapped_column(String(50))
    weight_kg:           Mapped[float]      = mapped_column(Float)
    volume_m3:           Mapped[float]      = mapped_column(Float)
    fragile:             Mapped[bool]       = mapped_column(Boolean)
    priority:            Mapped[str]        = mapped_column(String(50))
    payment_method:      Mapped[str]        = mapped_column(String(100))
    cod_amount_eur:      Mapped[float | None] = mapped_column(Float, nullable=True)
    insurance_value_eur: Mapped[float | None] = mapped_column(Float, nullable=True)
    special_instructions: Mapped[str | None] = mapped_column(Text)
    order_date:          Mapped[date | None] = mapped_column(Date, nullable=True)
    status:              Mapped[str]        = mapped_column(String(100))
    geocode_status:      Mapped[str | None] = mapped_column(String(20), nullable=True)
    lat:                 Mapped[float]      = mapped_column(Float)
    lon:                 Mapped[float]      = mapped_column(Float)


class Assignment(Base):
    __tablename__ = "assignments"

    id:              Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    driver_id:       Mapped[str] = mapped_column(String(20), ForeignKey("drivers.driver_id"))
    package_id:      Mapped[int] = mapped_column(Integer, ForeignKey("packages.id"))
    sequence_number: Mapped[int] = mapped_column(Integer, default=0)
    created_at:      Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


FAILURE_REASONS = [
    "nobody_home",
    "refused",
    "wrong_address",
    "access_blocked",
    "damaged",
    "rescheduled",
    "other",
]


class DeliveryEvent(Base):
    __tablename__ = "delivery_events"
    __table_args__ = (UniqueConstraint("driver_id", "package_id", "date", name="uq_event_driver_pkg_date"),)

    id:         Mapped[int]          = mapped_column(Integer, primary_key=True, autoincrement=True)
    driver_id:  Mapped[str]          = mapped_column(String(20), ForeignKey("drivers.driver_id"))
    package_id: Mapped[int]          = mapped_column(Integer, ForeignKey("packages.id"))
    date:       Mapped[date]         = mapped_column(Date, nullable=False)
    status:     Mapped[str]          = mapped_column(String(20))           # "delivered" | "failed"
    reason:     Mapped[str | None]   = mapped_column(String(50), nullable=True)   # one of FAILURE_REASONS
    note:       Mapped[str | None]   = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime]     = mapped_column(DateTime(timezone=True), server_default=func.now())
