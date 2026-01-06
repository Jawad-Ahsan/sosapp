from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
import os
import math
from . import models
from . import database

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkey123")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 1440))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def calculate_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371
    lat1_rad, lat2_rad = math.radians(lat1), math.radians(lat2)
    delta_lat, delta_lon = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

def mask_cnic(cnic: str) -> str:
    """Mask CNIC showing only last 4 digits"""
    if cnic and len(cnic) >= 4:
        return "*" * (len(cnic) - 4) + cnic[-4:]
    return cnic

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        cnic: str = payload.get("sub")
        if cnic is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(models.User).filter(models.User.cnic == cnic).first()
    if user is None:
        raise credentials_exception
    return user

def get_active_user(current_user: models.User = Depends(get_current_user)):
    """Ensure user account is active (not suspended or deleted)"""
    if current_user.account_status == 'suspended':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been suspended and is under review by admin."
        )
    if current_user.account_status == 'deleted':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deleted."
        )
    return current_user

def get_approved_user(current_user: models.User = Depends(get_active_user)):
    if current_user.user_type == 'police' and current_user.approval_status != 'approved':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account pending approval. Status: {current_user.approval_status}"
        )
    return current_user

def get_admin_user(current_user: models.User = Depends(get_active_user)):
    if current_user.user_type != 'admin':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user

def get_police_user(current_user: models.User = Depends(get_approved_user)):
    if current_user.user_type != 'police':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Police officer access required")
    return current_user
