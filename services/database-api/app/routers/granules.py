from typing import List, Annotated
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import Granule
from ..schemas.granules import GranuleResponse

router = APIRouter(prefix="/api/granules", tags=["Granules"])

@router.get("", response_model=List[GranuleResponse])
def list_granules(
    db: Annotated[Session, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=1000)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0
) -> List[GranuleResponse]:
    return (
        db.query(Granule)
        .order_by(Granule.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
