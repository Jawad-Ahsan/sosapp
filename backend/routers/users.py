from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from pathlib import Path
import shutil
import models, schemas, database, utils
from ocr_service import ocr_service
from email_service import email_service

router = APIRouter(tags=["Users"])

# Upload directories
UPLOAD_DIR = Path("uploads/cnic_images")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
POLICE_ID_DIR = Path("uploads/police_id_images")
POLICE_ID_DIR.mkdir(parents=True, exist_ok=True)

@router.post("/upload-cnic-images", response_model=schemas.CNICOCRResult)
async def upload_cnic_images(
    front_image: UploadFile = File(...),
    back_image: UploadFile = File(...),
    current_user: models.User = Depends(utils.get_current_user),
    db: Session = Depends(database.get_db)
):
    user_dir = UPLOAD_DIR / str(current_user.id)
    user_dir.mkdir(parents=True, exist_ok=True)
    
    front_path = user_dir / f"front_{front_image.filename}"
    with open(front_path, "wb") as buffer:
        shutil.copyfileobj(front_image.file, buffer)
    
    back_path = user_dir / f"back_{back_image.filename}"
    with open(back_path, "wb") as buffer:
        shutil.copyfileobj(back_image.file, buffer)
    
    current_user.cnic_front_image = str(front_path)
    current_user.cnic_back_image = str(back_path)
    db.commit()
    
    ocr_result = ocr_service.extract_cnic_info(str(front_path), str(back_path))
    
    match_success = False
    if ocr_result['cnic_extracted']:
        extracted_cnic = ocr_result['cnic_extracted'].replace('-', '')
        match_success = extracted_cnic == current_user.cnic
        
        if match_success:
            if ocr_result['full_name']:
                current_user.full_name = ocr_result['full_name']
            if ocr_result['father_name']:
                current_user.father_name = ocr_result['father_name']
            if ocr_result['date_of_birth']:
                for fmt in ['%d/%m/%Y', '%d-%m-%Y', '%Y-%m-%d', '%d.%m.%Y']:
                    try:
                        current_user.date_of_birth = datetime.strptime(ocr_result['date_of_birth'], fmt).date()
                        break
                    except: pass
            if ocr_result['gender']:
                current_user.gender = ocr_result['gender']
            if ocr_result['address']:
                current_user.address = ocr_result['address']
            db.commit()
    
    return {**ocr_result, "match_success": match_success}

@router.post("/upload-police-id")
async def upload_police_id(
    front_image: UploadFile = File(...),
    back_image: UploadFile = File(...),
    current_user: models.User = Depends(utils.get_current_user),
    db: Session = Depends(database.get_db)
):
    if current_user.user_type != 'police':
        raise HTTPException(status_code=400, detail="Only police officers can upload police ID")
    
    user_dir = POLICE_ID_DIR / str(current_user.id)
    user_dir.mkdir(parents=True, exist_ok=True)
    
    front_path = user_dir / f"front_{front_image.filename}"
    with open(front_path, "wb") as buffer:
        shutil.copyfileobj(front_image.file, buffer)
    
    back_path = user_dir / f"back_{back_image.filename}"
    with open(back_path, "wb") as buffer:
        shutil.copyfileobj(back_image.file, buffer)
    
    current_user.police_id_front_image = str(front_path)
    current_user.police_id_back_image = str(back_path)
    db.commit()
    
    return {"message": "Police ID images uploaded successfully", "status": "pending_approval"}

@router.post("/send-otp")
def send_otp(request: schemas.OTPRequest, current_user: models.User = Depends(utils.get_current_user), db: Session = Depends(database.get_db)):
    otp = email_service.generate_otp()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    
    db.query(models.OTPStore).filter(models.OTPStore.email == request.email).delete()
    otp_record = models.OTPStore(email=request.email, otp=otp, expires_at=expires_at)
    db.add(otp_record)
    db.commit()
    
    if not email_service.send_otp_email(request.email, otp):
        raise HTTPException(status_code=500, detail="Failed to send OTP email")
    
    return {"message": "OTP sent successfully", "email": request.email}

@router.post("/verify-otp")
def verify_otp(request: schemas.OTPVerify, current_user: models.User = Depends(utils.get_current_user), db: Session = Depends(database.get_db)):
    otp_record = db.query(models.OTPStore).filter(
        models.OTPStore.email == request.email, models.OTPStore.otp == request.otp
    ).first()
    
    if not otp_record:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    expires_at = otp_record.expires_at.replace(tzinfo=timezone.utc) if otp_record.expires_at.tzinfo is None else otp_record.expires_at
    if datetime.now(timezone.utc) > expires_at:
        db.delete(otp_record)
        db.commit()
        raise HTTPException(status_code=400, detail="OTP expired")
    
    current_user.email = request.email
    current_user.email_verified = True
    db.delete(otp_record)
    db.commit()
    
    return {"message": "Email verified successfully"}

@router.post("/complete-profile")
def complete_profile(request: schemas.ProfileContactSetup, current_user: models.User = Depends(utils.get_current_user), db: Session = Depends(database.get_db)):
    if not current_user.email_verified:
        raise HTTPException(status_code=400, detail="Email must be verified first")
    
    current_user.email = request.email
    current_user.phone = request.phone
    current_user.profile_complete = True
    db.commit()
    
    return {"message": "Profile completed successfully"}

@router.post("/complete-police-profile")
def complete_police_profile(request: schemas.PoliceProfileSetup, current_user: models.User = Depends(utils.get_current_user), db: Session = Depends(database.get_db)):
    if current_user.user_type != 'police':
        raise HTTPException(status_code=400, detail="Only police officers can use this endpoint")
    if not current_user.email_verified:
        raise HTTPException(status_code=400, detail="Email must be verified first")
    
    current_user.email = request.email
    current_user.phone = request.phone
    current_user.police_station = request.police_station
    current_user.police_rank = request.police_rank
    current_user.profile_complete = True
    db.commit()
    
    return {"message": "Police profile completed successfully", "approval_status": current_user.approval_status}

@router.get("/profile", response_model=schemas.UserProfile)
def get_profile(current_user: models.User = Depends(utils.get_current_user)):
    return current_user

@router.put("/profile", response_model=schemas.UserProfile)
def update_profile(request: schemas.ProfileUpdate, current_user: models.User = Depends(utils.get_current_user), db: Session = Depends(database.get_db)):
    if request.full_name: current_user.full_name = request.full_name
    if request.phone: current_user.phone = request.phone
    if request.address: current_user.address = request.address
    if request.police_station and current_user.user_type == 'police':
        current_user.police_station = request.police_station
    if request.police_rank and current_user.user_type == 'police':
        current_user.police_rank = request.police_rank
    
    db.commit()
    db.refresh(current_user)
    return current_user

@router.put("/location")
def update_location(location: schemas.LocationUpdate, current_user: models.User = Depends(utils.get_approved_user), db: Session = Depends(database.get_db)):
    current_user.last_latitude = location.latitude
    current_user.last_longitude = location.longitude
    current_user.last_location_update = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Location updated"}

@router.put("/push-token")
def update_push_token(token_data: schemas.PushTokenUpdate, current_user: models.User = Depends(utils.get_current_user), db: Session = Depends(database.get_db)):
    current_user.push_token = token_data.push_token
    db.commit()
    return {"message": "Push token updated"}

@router.get("/check-approval")
def check_approval_status(current_user: models.User = Depends(utils.get_current_user)):
    return {
        "user_type": current_user.user_type,
        "approval_status": current_user.approval_status,
        "account_status": current_user.account_status,
        "profile_complete": current_user.profile_complete
    }
