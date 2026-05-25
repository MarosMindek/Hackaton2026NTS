from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Driver
from app.schemas import DriverRead

router = APIRouter(prefix="/drivers", tags=["drivers"])


@router.get("", response_model=list[DriverRead])
def list_drivers(
    zone: str | None = Query(None),
    db: Session = Depends(get_db),
):
    stmt = select(Driver)
    if zone:
        stmt = stmt.where(Driver.zone_mestska_cast == zone)
    stmt = stmt.order_by(Driver.zone_mestska_cast, Driver.driver_id)
    return db.execute(stmt).scalars().all()
