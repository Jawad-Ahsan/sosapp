from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import timedelta
from .. import models, schemas, database
from .. import utils

router = APIRouter(tags=["Auth"])

@router.post("/signup", response_model=schemas.Token, status_code=status.HTTP_201_CREATED)
def signup(user: schemas.CNICSignup, db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.cnic == user.cnic).first()
    if db_user:
        raise HTTPException(status_code=400, detail="CNIC already registered")
    
    approval_status = 'pending' if user.user_type == 'police' else 'approved'
    new_user = models.User(
        cnic=user.cnic,
        password_hash=utils.get_password_hash(user.password),
        user_type=user.user_type,
        approval_status=approval_status,
        account_status='active',
        profile_complete=False,
        email_verified=False
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    access_token = utils.create_access_token(
        data={"sub": new_user.cnic},
        expires_delta=timedelta(minutes=utils.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    return {
        "access_token": access_token, "token_type": "bearer",
        "profile_complete": new_user.profile_complete,
        "user_type": new_user.user_type,
        "approval_status": new_user.approval_status,
        "account_status": new_user.account_status
    }

@router.post("/signup/police", response_model=schemas.Token, status_code=status.HTTP_201_CREATED)
def signup_police(user: schemas.PoliceSignup, db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.cnic == user.cnic).first()
    if db_user:
        raise HTTPException(status_code=400, detail="CNIC already registered")
    
    new_user = models.User(
        cnic=user.cnic,
        password_hash=utils.get_password_hash(user.password),
        user_type='police',
        approval_status='pending',
        account_status='active',
        police_badge_number=user.badge_number,
        profile_complete=False,
        email_verified=False
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    access_token = utils.create_access_token(
        data={"sub": new_user.cnic},
        expires_delta=timedelta(minutes=utils.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    return {
        "access_token": access_token, "token_type": "bearer",
        "profile_complete": new_user.profile_complete,
        "user_type": new_user.user_type,
        "approval_status": new_user.approval_status,
        "account_status": new_user.account_status
    }

@router.post("/login", response_model=schemas.Token)
def login(user: schemas.CNICLogin, db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.cnic == user.cnic).first()
    if not db_user or not utils.verify_password(user.password, db_user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect CNIC or password")
    
    if db_user.user_type != user.user_type:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"This account is registered as {db_user.user_type}, not {user.user_type}")
    
    # Check account status
    if db_user.account_status == 'suspended':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been suspended and is under review by admin.")
    if db_user.account_status == 'deleted':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account has been deleted.")
    
    access_token = utils.create_access_token(
        data={"sub": db_user.cnic},
        expires_delta=timedelta(minutes=utils.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {
        "access_token": access_token, "token_type": "bearer",
        "profile_complete": db_user.profile_complete,
        "user_type": db_user.user_type,
        "approval_status": db_user.approval_status,
        "account_status": db_user.account_status
    }
