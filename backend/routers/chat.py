from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import List
import models, schemas, database, utils
from socket_manager import sio

router = APIRouter(tags=["Chat"])

@router.get("/chat/{alert_id}", response_model=List[schemas.ChatMessageOut])
def get_chat_messages(alert_id: int, current_user: models.User = Depends(utils.get_approved_user), db: Session = Depends(database.get_db)):
    alert = db.query(models.Alert).filter(models.Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    # Verify user is either the citizen or the responding officer
    if alert.user_id != current_user.id and alert.responded_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this chat")
    
    messages = db.query(models.ChatMessage).filter(
        models.ChatMessage.alert_id == alert_id
    ).order_by(models.ChatMessage.created_at).all()
    
    result = []
    for msg in messages:
        sender = db.query(models.User).filter(models.User.id == msg.sender_id).first()
        result.append({
            "id": msg.id, "alert_id": msg.alert_id,
            "sender_id": msg.sender_id, "receiver_id": msg.receiver_id,
            "message": msg.message, "message_type": msg.message_type,
            "created_at": msg.created_at, "read_at": msg.read_at,
            "is_mine": msg.sender_id == current_user.id,
            "sender_name": sender.full_name if sender else "Unknown",
            "sender_type": sender.user_type if sender else None
        })
    
    # Mark messages as read
    db.query(models.ChatMessage).filter(
        models.ChatMessage.alert_id == alert_id,
        models.ChatMessage.receiver_id == current_user.id,
        models.ChatMessage.read_at.is_(None)
    ).update({"read_at": datetime.now(timezone.utc)})
    db.commit()
    
    return result

@router.post("/chat/{alert_id}", response_model=schemas.ChatMessageOut)
async def send_chat_message(alert_id: int, message: schemas.ChatMessageCreate, current_user: models.User = Depends(utils.get_approved_user), db: Session = Depends(database.get_db)):
    alert = db.query(models.Alert).filter(models.Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    # Verify user is either the citizen or the responding officer
    if alert.user_id != current_user.id and alert.responded_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to send messages in this chat")
    
    # Determine receiver
    receiver_id = alert.responded_by if current_user.id == alert.user_id else alert.user_id
    
    new_message = models.ChatMessage(
        alert_id=alert_id,
        sender_id=current_user.id,
        receiver_id=receiver_id,
        message=message.message,
        message_type=message.message_type
    )
    db.add(new_message)
    db.commit()
    db.refresh(new_message)
    
    # Emit Real-time Message
    msg_data = schemas.ChatMessageOut.from_orm(new_message).dict()
    msg_data['is_mine'] = False # For the receiver it's not theirs
    msg_data['sender_name'] = current_user.full_name
    msg_data['sender_type'] = current_user.user_type
    
    for k, v in msg_data.items():
        if isinstance(v, datetime): msg_data[k] = v.isoformat()
        
    # Send to specific alert room (both parties should be in it ideally, or send to specific user room)
    # Strategy: send to receiver's user room
    await sio.emit('new_message', msg_data, room=f"user_{receiver_id}")
    
    return {
        "id": new_message.id, "alert_id": new_message.alert_id,
        "sender_id": new_message.sender_id, "receiver_id": new_message.receiver_id,
        "message": new_message.message, "message_type": new_message.message_type,
        "created_at": new_message.created_at, "read_at": new_message.read_at,
        "is_mine": True, "sender_name": current_user.full_name,
        "sender_type": current_user.user_type
    }

@router.get("/chat/{alert_id}/unread")
def get_unread_count(alert_id: int, current_user: models.User = Depends(utils.get_approved_user), db: Session = Depends(database.get_db)):
    count = db.query(models.ChatMessage).filter(
        models.ChatMessage.alert_id == alert_id,
        models.ChatMessage.receiver_id == current_user.id,
        models.ChatMessage.read_at.is_(None)
    ).count()
    return {"unread_count": count}
