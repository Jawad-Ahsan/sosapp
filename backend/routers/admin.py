from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime, timezone
from typing import List
import models, schemas, database, utils

router = APIRouter(tags=["Admin"])

@router.get("/admin/pending-officers", response_model=List[schemas.PendingOfficer])
def get_pending_officers(current_user: models.User = Depends(utils.get_admin_user), db: Session = Depends(database.get_db)):
    return db.query(models.User).filter(
        models.User.user_type == 'police',
        models.User.approval_status == 'pending'
    ).order_by(desc(models.User.created_at)).all()

@router.get("/admin/all-officers", response_model=List[schemas.AdminUserItem])
def get_all_officers(current_user: models.User = Depends(utils.get_admin_user), db: Session = Depends(database.get_db)):
    return db.query(models.User).filter(
        models.User.user_type == 'police'
    ).order_by(desc(models.User.created_at)).all()

@router.get("/admin/all-citizens", response_model=List[schemas.AdminUserItem])
def get_all_citizens(current_user: models.User = Depends(utils.get_admin_user), db: Session = Depends(database.get_db)):
    return db.query(models.User).filter(
        models.User.user_type == 'citizen'
    ).order_by(desc(models.User.created_at)).all()

@router.get("/admin/user/{user_id}", response_model=schemas.AdminUserItem)
def get_user_details(user_id: int, current_user: models.User = Depends(utils.get_admin_user), db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.post("/admin/approve/{user_id}")
def approve_officer(user_id: int, approval: schemas.AdminApproval = None, current_user: models.User = Depends(utils.get_admin_user), db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.user_type != 'police':
        raise HTTPException(status_code=400, detail="User is not a police officer")
    
    user.approval_status = 'approved'
    db.commit()
    return {"message": "Officer approved successfully", "user_id": user_id}

@router.post("/admin/reject/{user_id}")
def reject_officer(user_id: int, rejection: schemas.AdminApproval = None, current_user: models.User = Depends(utils.get_admin_user), db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.user_type != 'police':
        raise HTTPException(status_code=400, detail="User is not a police officer")
    
    user.approval_status = 'rejected'
    db.commit()
    return {"message": "Officer rejected", "user_id": user_id}

@router.post("/admin/suspend/{user_id}")
def suspend_user(user_id: int, suspension: schemas.AdminSuspension, current_user: models.User = Depends(utils.get_admin_user), db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.user_type == 'admin':
        raise HTTPException(status_code=400, detail="Cannot suspend admin accounts")
    
    user.account_status = 'suspended'
    user.suspension_reason = suspension.reason
    user.suspended_at = datetime.now(timezone.utc)
    user.suspended_by = current_user.id
    db.commit()
    
    return {"message": f"User {user.cnic} suspended", "reason": suspension.reason}

@router.post("/admin/unsuspend/{user_id}")
def unsuspend_user(user_id: int, current_user: models.User = Depends(utils.get_admin_user), db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.account_status = 'active'
    user.suspension_reason = None
    user.suspended_at = None
    user.suspended_by = None
    db.commit()
    
    return {"message": f"User {user.cnic} reactivated"}

@router.delete("/admin/user/{user_id}")
def delete_user(user_id: int, current_user: models.User = Depends(utils.get_admin_user), db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.user_type == 'admin':
        raise HTTPException(status_code=400, detail="Cannot delete admin accounts")
    
    user.account_status = 'deleted'
    db.commit()
    
    return {"message": f"User {user.cnic} deleted"}
