from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime, timezone
from pathlib import Path
from typing import List
import shutil
import uuid
import models, schemas, database, utils
from transcription_service import start_transcription
from socket_manager import sio

router = APIRouter(tags=["Alerts"])

AUDIO_UPLOAD_DIR = Path("uploads/audio")
AUDIO_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)



@router.post("/alerts", response_model=schemas.AlertOut, status_code=status.HTTP_201_CREATED)
async def create_alert(
    alert: schemas.AlertCreate, 
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(utils.get_approved_user), 
    db: Session = Depends(database.get_db)
):
    # Determine transcription status for voice alerts
    transcription_status = 'pending' if alert.alert_type == 'voice' and alert.audio_url else 'none'
    
    new_alert = models.Alert(
        user_id=current_user.id,
        alert_type=alert.alert_type,
        content=alert.content,
        audio_url=alert.audio_url,
        latitude=alert.latitude,
        longitude=alert.longitude,
        tag=alert.tag,
        status='pending',
        transcription_status=transcription_status
    )
    db.add(new_alert)
    db.commit()
    db.refresh(new_alert)
    
    # Start background transcription for voice alerts
    if alert.alert_type == 'voice' and alert.audio_url:
        # Construct full path to audio file
        audio_path = str(AUDIO_UPLOAD_DIR / alert.audio_url.replace('/audio/', ''))
        # Using FastAPI BackgroundTasks instead of raw thread (though implementation of start_transcription uses thread)
        # We can wrap it here or rely on the service. The service uses threading.Thread which is async enough.
        # But let's pass it to BackgroundTasks for better practice if we refactor service.
        # For now, start_transcription expects db_session_factory
        start_transcription(new_alert.id, audio_path, database.SessionLocal)
    
    # Emit WebSockets
    alert_data = schemas.AlertOut.from_orm(new_alert).dict()
    for k, v in alert_data.items():
        if isinstance(v, datetime): alert_data[k] = v.isoformat()
    
    await sio.emit('new_alert', alert_data, room='police_all')
    
    return new_alert

@router.get("/alerts", response_model=List[schemas.AlertOut])
def get_alerts(current_user: models.User = Depends(utils.get_approved_user), db: Session = Depends(database.get_db)):
    alerts = db.query(models.Alert).filter(models.Alert.user_id == current_user.id).order_by(desc(models.Alert.created_at)).all()
    
    result = []
    for alert in alerts:
        # Check if there are chat messages
        has_chat = db.query(models.ChatMessage).filter(models.ChatMessage.alert_id == alert.id).first() is not None
        
        alert_dict = {
            "id": alert.id, "alert_type": alert.alert_type, "content": alert.content,
            "audio_url": alert.audio_url, "created_at": alert.created_at,
            "latitude": alert.latitude, "longitude": alert.longitude,
            "tag": alert.tag, "status": alert.status,
            "responded_by": alert.responded_by, "responded_at": alert.responded_at,
            "responding_officer": None, "has_chat": has_chat,
            "transcription": alert.transcription,
            "transcription_keywords": alert.transcription_keywords,
            "transcription_status": alert.transcription_status
        }
        
        if alert.responded_by:
            officer = db.query(models.User).filter(models.User.id == alert.responded_by).first()
            if officer:
                alert_dict["responding_officer"] = {
                    "id": officer.id, "full_name": officer.full_name,
                    "badge_number": officer.police_badge_number, "phone": officer.phone
                }
        result.append(alert_dict)
    return result

@router.get("/alerts/nearby", response_model=List[schemas.AlertForPolice])
def get_nearby_alerts(
    latitude: float = Query(...),
    longitude: float = Query(...),
    current_user: models.User = Depends(utils.get_police_user),
    db: Session = Depends(database.get_db)
):
    # Get pending alerts
    pending_alerts = db.query(models.Alert).filter(
        models.Alert.status == 'pending',
        models.Alert.latitude.isnot(None),
        models.Alert.longitude.isnot(None)
    ).all()

    # Get alerts responded to by THIS officer (active responses)
    my_active_responses = db.query(models.Alert).filter(
        models.Alert.status == 'responded',
        models.Alert.responded_by == current_user.id
    ).all()
    
    # Combine lists
    all_relevant_alerts = pending_alerts + my_active_responses
    
    # Sort by creation time (descending)
    all_relevant_alerts.sort(key=lambda x: x.created_at, reverse=True)
    
    result = []
    for alert in all_relevant_alerts:
        distance = utils.calculate_distance_km(latitude, longitude, alert.latitude, alert.longitude)
        sender = db.query(models.User).filter(models.User.id == alert.user_id).first()
        
        result.append({
            "id": alert.id, "alert_type": alert.alert_type, "content": alert.content,
            "audio_url": alert.audio_url, "created_at": alert.created_at,
            "latitude": alert.latitude, "longitude": alert.longitude,
            "tag": alert.tag, "status": alert.status,
            "distance_km": round(distance, 2),
            "sender": {
                "id": sender.id,
                "full_name": sender.full_name,
                "cnic_masked": utils.mask_cnic(sender.cnic),
                "email": sender.email,
                "phone": sender.phone,
                "address": sender.address,
                "gender": sender.gender
            } if sender else None,
            # Transcription fields
            "transcription": alert.transcription,
            "transcription_keywords": alert.transcription_keywords,
            "transcription_status": alert.transcription_status or 'none'
        })
    
    result.sort(key=lambda x: x["distance_km"])
    return result

@router.post("/alerts/{alert_id}/respond", response_model=schemas.AlertResponseOut)
async def respond_to_alert(
    alert_id: int,
    response: schemas.AlertResponseCreate,
    current_user: models.User = Depends(utils.get_police_user),
    db: Session = Depends(database.get_db)
):
    alert = db.query(models.Alert).filter(models.Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    if alert.status != 'pending':
        raise HTTPException(status_code=400, detail="Alert has already been responded to")
    
    distance_km = None
    if response.officer_latitude and response.officer_longitude and alert.latitude and alert.longitude:
        distance_km = utils.calculate_distance_km(response.officer_latitude, response.officer_longitude, alert.latitude, alert.longitude)
    
    alert_response = models.AlertResponse(
        alert_id=alert_id,
        officer_id=current_user.id,
        officer_latitude=response.officer_latitude,
        officer_longitude=response.officer_longitude,
        distance_km=distance_km,
        notes=response.notes,
        status='en_route'
    )
    db.add(alert_response)
    
    alert.status = 'responded'
    alert.responded_by = current_user.id
    alert.responded_at = datetime.now(timezone.utc)
    
    # Create auto chat message
    citizen = db.query(models.User).filter(models.User.id == alert.user_id).first()
    auto_message = models.ChatMessage(
        alert_id=alert_id,
        sender_id=current_user.id,
        receiver_id=alert.user_id,
        message=f"🚔 Help is on the way! Officer {current_user.full_name or 'Unknown'} (Badge: {current_user.police_badge_number}) is responding to your emergency.",
        message_type='auto'
    )
    db.add(auto_message)
    
    db.commit()
    db.refresh(alert_response)
    
    # Emit to User
    response_data = schemas.AlertResponseOut.from_orm(alert_response).dict()
    for k, v in response_data.items():
        if isinstance(v, datetime): response_data[k] = v.isoformat()
        
    await sio.emit('alert_response', response_data, room=f"user_{alert.user_id}")
    
    return {
        "id": alert_response.id, "alert_id": alert_response.alert_id,
        "officer_id": alert_response.officer_id, "response_time": alert_response.response_time,
        "status": alert_response.status, "officer_latitude": alert_response.officer_latitude,
        "officer_longitude": alert_response.officer_longitude, "distance_km": alert_response.distance_km,
        "notes": alert_response.notes,
        "officer": {"id": current_user.id, "full_name": current_user.full_name,
                   "badge_number": current_user.police_badge_number, "phone": current_user.phone}
    }

@router.put("/alerts/{alert_id}/status")
def update_response_status(alert_id: int, status_update: schemas.AlertResponseUpdate, current_user: models.User = Depends(utils.get_police_user), db: Session = Depends(database.get_db)):
    response = db.query(models.AlertResponse).filter(
        models.AlertResponse.alert_id == alert_id,
        models.AlertResponse.officer_id == current_user.id
    ).first()
    
    if not response:
        raise HTTPException(status_code=404, detail="Response not found")
    
    response.status = status_update.status
    if status_update.notes: response.notes = status_update.notes
    
    if status_update.status == 'resolved':
        alert = db.query(models.Alert).filter(models.Alert.id == alert_id).first()
        if alert: alert.status = 'resolved'
    
    db.commit()
    return {"message": f"Status updated to {status_update.status}"}

@router.get("/police/history", response_model=List[schemas.PoliceHistoryItem])
def get_police_history(current_user: models.User = Depends(utils.get_police_user), db: Session = Depends(database.get_db)):
    responses = db.query(models.AlertResponse).filter(
        models.AlertResponse.officer_id == current_user.id
    ).order_by(desc(models.AlertResponse.response_time)).all()
    
    result = []
    for resp in responses:
        alert = db.query(models.Alert).filter(models.Alert.id == resp.alert_id).first()
        citizen = db.query(models.User).filter(models.User.id == alert.user_id).first() if alert else None
        
        result.append({
            "id": resp.id, "alert_id": resp.alert_id, "response_time": resp.response_time,
            "status": resp.status, "distance_km": resp.distance_km,
            "alert_type": alert.alert_type if alert else None,
            "alert_tag": alert.tag if alert else None,
            "alert_content": alert.content if alert else None,
            "citizen_name": citizen.full_name if citizen else None,
            "citizen_phone": citizen.phone if citizen else None,
            "latitude": alert.latitude if alert else None,
            "longitude": alert.longitude if alert else None,
            "audio_url": alert.audio_url if alert else None,
            "transcription": alert.transcription if alert else None
        })
    return result

@router.post("/upload-audio")
async def upload_audio(audio_file: UploadFile = File(...), current_user: models.User = Depends(utils.get_current_user)):
    file_extension = audio_file.filename.split('.')[-1] if '.' in audio_file.filename else 'm4a'
    unique_filename = f"{current_user.id}_{uuid.uuid4().hex}.{file_extension}"
    file_path = AUDIO_UPLOAD_DIR / unique_filename
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(audio_file.file, buffer)
    
    return {"audio_url": f"/audio/{unique_filename}", "filename": unique_filename}

@router.get("/audio/{filename}")
async def get_audio(filename: str):
    file_path = AUDIO_UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(file_path, media_type="audio/m4a")
