from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func

from .database import engine, Base, get_db
from .models import Granule, RawMeasurement, OzoneGridSummary, OzoneAnomaly, ClusterResult
from .schemas import (
    GranuleCreate, GranuleResponse,
    RawMeasurementBulkCreate, RawMeasurementResponse,
    GridSummaryBulkCreate, GridSummaryResponse,
    AnomalyCreate, ClusterBulkCreate
)

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Ozone Database Microservice API",
    version="1.0.0",
    description="Central Database REST API for NASA Ozone Satellite Data System"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "database-api", "timestamp": datetime.utcnow().isoformat()}

# --- Granules API ---
@app.get("/api/granules", response_model=List[GranuleResponse])
def get_granules(limit: int = 50, db: Session = Depends(get_db)):
    return db.query(Granule).order_by(Granule.created_at.desc()).limit(limit).all()

@app.post("/api/granules", response_model=GranuleResponse)
def create_granule(granule_in: GranuleCreate, db: Session = Depends(get_db)):
    existing = db.query(Granule).filter(Granule.filename == granule_in.filename).first()
    if existing:
        return existing
    db_item = Granule(**granule_in.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@app.patch("/api/granules/{filename}/status")
def update_granule_status(filename: str, process_status: str, db: Session = Depends(get_db)):
    granule = db.query(Granule).filter(Granule.filename == filename).first()
    if not granule:
        raise HTTPException(status_code=404, detail="Granule not found")
    granule.process_status = process_status
    db.commit()
    return {"filename": filename, "process_status": process_status}

# --- Raw Measurements API ---
@app.get("/api/raw-measurements", response_model=List[RawMeasurementResponse])
def get_raw_measurements(
    limit: int = 100,
    offset: int = 0,
    granule_name: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(RawMeasurement)
    if granule_name:
        query = query.filter(RawMeasurement.granule_name == granule_name)
    return query.order_by(RawMeasurement.id.asc()).offset(offset).limit(limit).all()

@app.post("/api/raw-measurements/bulk")
def insert_raw_bulk(payload: RawMeasurementBulkCreate, db: Session = Depends(get_db)):
    objects = [
        RawMeasurement(
            granule_name=payload.granule_name,
            point_index=it.point_index,
            latitude=it.latitude,
            longitude=it.longitude,
            ozone_column_raw=it.ozone_column_raw,
            quality_flag=it.quality_flag,
            time_raw=it.time_raw
        )
        for it in payload.items
    ]
    db.bulk_save_objects(objects)
    db.commit()
    return {"message": f"Successfully inserted {len(objects)} raw measurement points."}

# --- Grid Summary API ---
@app.get("/api/grid-summary", response_model=List[GridSummaryResponse])
def get_grid_summary(limit: int = 500, db: Session = Depends(get_db)):
    return db.query(OzoneGridSummary).order_by(OzoneGridSummary.timestamp.desc()).limit(limit).all()

@app.post("/api/grid-summary/bulk")
def insert_grid_bulk(payload: GridSummaryBulkCreate, db: Session = Depends(get_db)):
    objects = [
        OzoneGridSummary(
            source_filename=it.source_filename,
            timestamp=it.timestamp or datetime.utcnow(),
            lat_bin=it.lat_bin,
            lon_bin=it.lon_bin,
            ozone_column_mean=it.ozone_column_mean,
            ozone_column_min=it.ozone_column_min,
            ozone_column_max=it.ozone_column_max,
            valid_pixel_count=it.valid_pixel_count
        )
        for it in payload.items
    ]
    db.bulk_save_objects(objects)
    db.commit()
    return {"message": f"Successfully inserted {len(objects)} grid summary cells."}

# --- Anomalies & Clusters ---
@app.get("/api/anomalies")
def get_anomalies(limit: int = 100, db: Session = Depends(get_db)):
    return db.query(OzoneAnomaly).order_by(OzoneAnomaly.timestamp.desc()).limit(limit).all()

@app.post("/api/anomalies")
def create_anomaly(item: AnomalyCreate, db: Session = Depends(get_db)):
    record = OzoneAnomaly(**item.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record

@app.get("/api/clusters")
def get_clusters(limit: int = 200, db: Session = Depends(get_db)):
    return db.query(ClusterResult).order_by(ClusterResult.run_timestamp.desc()).limit(limit).all()

@app.post("/api/clusters/bulk")
def insert_clusters(payload: ClusterBulkCreate, db: Session = Depends(get_db)):
    objs = [ClusterResult(**it.model_dump()) for it in payload.items]
    db.bulk_save_objects(objs)
    db.commit()
    return {"message": f"Inserted {len(objs)} cluster data points"}

# --- Dashboard Stats API ---
@app.get("/api/stats")
def get_system_stats(db: Session = Depends(get_db)):
    total_granules = db.query(func.count(Granule.id)).scalar() or 0
    total_raw = db.query(func.count(RawMeasurement.id)).scalar() or 0
    total_grid = db.query(func.count(OzoneGridSummary.id)).scalar() or 0
    
    # Calculate ozone statistics from processed grid
    avg_ozone = db.query(func.avg(OzoneGridSummary.ozone_column_mean)).scalar() or 290.0
    min_ozone = db.query(func.min(OzoneGridSummary.ozone_column_min)).scalar() or 180.0
    max_ozone = db.query(func.max(OzoneGridSummary.ozone_column_max)).scalar() or 450.0
    anomaly_count = db.query(func.count(OzoneAnomaly.id)).scalar() or 0

    return {
        "total_granules": total_granules,
        "total_raw_measurements": total_raw,
        "total_grid_cells": total_grid,
        "avg_ozone_du": round(float(avg_ozone), 2),
        "min_ozone_du": round(float(min_ozone), 2),
        "max_ozone_du": round(float(max_ozone), 2),
        "anomalies_detected": anomaly_count,
        "last_updated": datetime.utcnow().isoformat()
    }

