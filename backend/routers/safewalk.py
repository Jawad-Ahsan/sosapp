from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from typing import List
from .. import models, schemas, database, utils

router = APIRouter(tags=["SafeWalk"])

@router.post("/safewalk/start", response_model=schemas.SafeWalkOut, status_code=status.HTTP_201_CREATED)
def start_safe_walk(session_data: schemas.SafeWalkCreate, current_user: models.User = Depends(utils.get_active_user), db: Session = Depends(database.get_db)):
    # Check if active session exists
    active_session = db.query(models.SafeWalkSession).filter(
        models.SafeWalkSession.user_id == current_user.id,
        models.SafeWalkSession.status == 'active'
    ).first()
    
    if active_session:
        # Check if actually expired
        if active_session.end_time < datetime.now(timezone.utc):
            active_session.status = 'emergency_triggered'
            # (In a real scenario, we might auto-trigger here if monitor missed it)
        else:
            raise HTTPException(status_code=400, detail="You already have an active Safe Walk session")
    
    end_time = datetime.now(timezone.utc) + timedelta(minutes=session_data.duration_minutes)
    
    new_session = models.SafeWalkSession(
        user_id=current_user.id,
        end_time=end_time,
        start_latitude=session_data.start_latitude,
        start_longitude=session_data.start_longitude,
        current_latitude=session_data.start_latitude,
        current_longitude=session_data.start_longitude,
        status='active'
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    
    return new_session

@router.post("/safewalk/{session_id}/checkin")
def check_in(session_id: int, location: schemas.SafeWalkUpdate, current_user: models.User = Depends(utils.get_current_user), db: Session = Depends(database.get_db)):
    session = db.query(models.SafeWalkSession).filter(
        models.SafeWalkSession.id == session_id,
        models.SafeWalkSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.status != 'active':
        raise HTTPException(status_code=400, detail="Session is not active")
    
    session.current_latitude = location.latitude
    session.current_longitude = location.longitude
    db.commit()
    
    return {"message": "Location updated"}

@router.post("/safewalk/{session_id}/end")
def end_safe_walk(session_id: int, current_user: models.User = Depends(utils.get_current_user), db: Session = Depends(database.get_db)):
    session = db.query(models.SafeWalkSession).filter(
        models.SafeWalkSession.id == session_id,
        models.SafeWalkSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.status != 'active':
        raise HTTPException(status_code=400, detail="Session is not active")
    
    session.status = 'completed'
    session.end_time = datetime.now(timezone.utc) # Update end time to actual completion
    db.commit()
    
    return {"message": "Safe Walk completed successfully"}

@router.post("/safewalk/{session_id}/panic")
def panic_button(session_id: int, current_user: models.User = Depends(utils.get_current_user), db: Session = Depends(database.get_db)):
    session = db.query(models.SafeWalkSession).filter(
        models.SafeWalkSession.id == session_id,
        models.SafeWalkSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session.status = 'emergency_triggered'
    session.end_time = datetime.now(timezone.utc)
    
    # Create actual Alert
    new_alert = models.Alert(
        user_id=current_user.id,
        alert_type='sos',
        content="Panic button pressed during Safe Walk.",
        latitude=session.current_latitude or session.start_latitude,
        longitude=session.current_longitude or session.start_longitude,
        tag='police',
        status='pending'
    )
    db.add(new_alert)
    db.commit()
    
    return {"message": "Emergency alert triggered!", "alert_id": new_alert.id}
