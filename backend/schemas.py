from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from datetime import datetime, date
import re

# CNIC Signup - Initial registration (for citizens)
class CNICSignup(BaseModel):
    cnic: str
    password: str
    user_type: str = 'citizen'  # 'citizen' or 'police'
    
    @field_validator('cnic')
    @classmethod
    def validate_cnic(cls, v):
        if not re.match(r'^\d{13}$', v):
            raise ValueError('CNIC must be exactly 13 digits')
        return v
    
    @field_validator('user_type')
    @classmethod
    def validate_user_type(cls, v):
        if v not in ['citizen', 'police']:
            raise ValueError('User type must be citizen or police')
        return v

# Police Signup - Registration with badge number
class PoliceSignup(BaseModel):
    cnic: str
    password: str
    badge_number: str
    
    @field_validator('cnic')
    @classmethod
    def validate_cnic(cls, v):
        if not re.match(r'^\d{13}$', v):
            raise ValueError('CNIC must be exactly 13 digits')
        return v
    
    @field_validator('badge_number')
    @classmethod
    def validate_badge(cls, v):
        if len(v) < 3:
            raise ValueError('Badge number must be at least 3 characters')
        return v

# CNIC Login
class CNICLogin(BaseModel):
    cnic: str
    password: str
    user_type: str = 'citizen'  # 'citizen', 'police', or 'admin'

# Token response - Extended with account status
class Token(BaseModel):
    access_token: str
    token_type: str
    profile_complete: bool
    user_type: str
    approval_status: str
    account_status: str = 'active'

# Profile Setup - Contact info
class ProfileContactSetup(BaseModel):
    email: EmailStr
    phone: str
    
    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v):
        if not re.match(r'^\d{10,15}$', v.replace('-', '').replace(' ', '')):
            raise ValueError('Phone must be 10-15 digits')
        return v.replace('-', '').replace(' ', '')

# Police Profile Setup
class PoliceProfileSetup(BaseModel):
    email: EmailStr
    phone: str
    police_station: str
    police_rank: str
    
    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v):
        if not re.match(r'^\d{10,15}$', v.replace('-', '').replace(' ', '')):
            raise ValueError('Phone must be 10-15 digits')
        return v.replace('-', '').replace(' ', '')

# OTP Request
class OTPRequest(BaseModel):
    email: EmailStr

# OTP Verification
class OTPVerify(BaseModel):
    email: EmailStr
    otp: str

# OCR Result from CNIC images
class CNICOCRResult(BaseModel):
    cnic_extracted: Optional[str] = None
    full_name: Optional[str] = None
    father_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    match_success: bool = False

# User Profile Response - Extended with all fields
class UserProfile(BaseModel):
    id: int
    cnic: str
    user_type: str
    approval_status: str
    account_status: str = 'active'
    full_name: Optional[str] = None
    father_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    email_verified: bool
    profile_complete: bool
    # Police-specific
    police_badge_number: Optional[str] = None
    police_station: Optional[str] = None
    police_rank: Optional[str] = None

    class Config:
        from_attributes = True

# Profile Update
class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    # Police-specific
    police_station: Optional[str] = None
    police_rank: Optional[str] = None

# Location Update
class LocationUpdate(BaseModel):
    latitude: float
    longitude: float

# Push Token Update
class PushTokenUpdate(BaseModel):
    push_token: str

# Alert Schemas - Extended with location and tag
class AlertCreate(BaseModel):
    alert_type: str  # 'sos', 'text', 'voice'
    content: Optional[str] = None
    audio_url: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    tag: Optional[str] = None  # 'police', 'fire', 'ambulance', 'wildlife', 'other'
    
    @field_validator('tag')
    @classmethod
    def validate_tag(cls, v):
        if v is not None:
            valid_tags = ['police', 'fire', 'ambulance', 'wildlife', 'other']
            if v.lower() not in valid_tags:
                raise ValueError(f'Tag must be one of: {", ".join(valid_tags)}')
            return v.lower()
        return v

# Officer info for responses
class OfficerInfo(BaseModel):
    id: int
    full_name: Optional[str]
    badge_number: Optional[str]
    phone: Optional[str]
    
    class Config:
        from_attributes = True

# Citizen info for officers
class CitizenInfo(BaseModel):
    id: int
    full_name: Optional[str]
    cnic_masked: Optional[str]  # Last 4 digits only
    email: Optional[str]
    phone: Optional[str]
    address: Optional[str]
    gender: Optional[str]
    
    class Config:
        from_attributes = True

# Alert Output - Extended with location, tag, responding officer, and transcription
class AlertOut(BaseModel):
    id: int
    alert_type: str
    content: Optional[str]
    audio_url: Optional[str] = None
    created_at: datetime
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    tag: Optional[str] = None
    status: str
    responded_by: Optional[int] = None
    responded_at: Optional[datetime] = None
    responding_officer: Optional[OfficerInfo] = None
    has_chat: bool = False
    # Transcription fields
    transcription: Optional[str] = None
    transcription_keywords: Optional[str] = None
    transcription_status: str = 'none'

    class Config:
        from_attributes = True

# Alert for Police Dashboard - includes full sender info, distance, and transcription
class AlertForPolice(BaseModel):
    id: int
    alert_type: str
    content: Optional[str]
    audio_url: Optional[str] = None
    created_at: datetime
    latitude: Optional[float]
    longitude: Optional[float]
    tag: Optional[str]
    status: str
    distance_km: Optional[float] = None
    sender: Optional[CitizenInfo] = None
    # Transcription fields
    transcription: Optional[str] = None
    transcription_keywords: Optional[str] = None
    transcription_status: str = 'none'

    class Config:
        from_attributes = True

# Alert Response - Officer responding to alert
class AlertResponseCreate(BaseModel):
    officer_latitude: Optional[float] = None
    officer_longitude: Optional[float] = None
    notes: Optional[str] = None

class AlertResponseUpdate(BaseModel):
    status: str  # 'en_route', 'arrived', 'resolved', 'cancelled'
    notes: Optional[str] = None
    
    @field_validator('status')
    @classmethod
    def validate_status(cls, v):
        valid_statuses = ['en_route', 'arrived', 'resolved', 'cancelled']
        if v not in valid_statuses:
            raise ValueError(f'Status must be one of: {", ".join(valid_statuses)}')
        return v

class AlertResponseOut(BaseModel):
    id: int
    alert_id: int
    officer_id: int
    response_time: datetime
    status: str
    officer_latitude: Optional[float]
    officer_longitude: Optional[float]
    distance_km: Optional[float]
    notes: Optional[str]
    officer: Optional[OfficerInfo] = None

    class Config:
        from_attributes = True

# Police History Item
class PoliceHistoryItem(BaseModel):
    id: int
    alert_id: int
    response_time: datetime
    status: str
    distance_km: Optional[float]
    alert_type: str
    alert_tag: Optional[str]
    alert_content: Optional[str]
    citizen_name: Optional[str]
    citizen_phone: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    audio_url: Optional[str] = None
    transcription: Optional[str] = None

    class Config:
        from_attributes = True

# ==================== ADMIN SCHEMAS ====================

# Admin - User list item (for both citizens and officers)
class AdminUserItem(BaseModel):
    id: int
    cnic: str
    user_type: str
    full_name: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    account_status: str
    approval_status: str
    created_at: datetime
    # Police-specific
    police_badge_number: Optional[str] = None
    police_station: Optional[str] = None
    police_rank: Optional[str] = None
    # Documents
    cnic_front_image: Optional[str] = None
    cnic_back_image: Optional[str] = None
    police_id_front_image: Optional[str] = None
    police_id_back_image: Optional[str] = None
    
    class Config:
        from_attributes = True

# Admin - Pending officers list (simplified)
class PendingOfficer(BaseModel):
    id: int
    cnic: str
    full_name: Optional[str]
    police_badge_number: Optional[str]
    police_station: Optional[str]
    police_rank: Optional[str]
    created_at: datetime
    cnic_front_image: Optional[str] = None
    cnic_back_image: Optional[str] = None
    police_id_front_image: Optional[str] = None
    police_id_back_image: Optional[str] = None
    
    class Config:
        from_attributes = True

# Admin approval/rejection
class AdminApproval(BaseModel):
    reason: Optional[str] = None

# Admin suspension
class AdminSuspension(BaseModel):
    reason: str
    
    @field_validator('reason')
    @classmethod
    def validate_reason(cls, v):
        if len(v) < 10:
            raise ValueError('Suspension reason must be at least 10 characters')
        return v

# ==================== CHAT SCHEMAS ====================

# Chat message create
class ChatMessageCreate(BaseModel):
    message: str
    message_type: str = 'text'  # 'text', 'location', 'image'
    
    @field_validator('message')
    @classmethod
    def validate_message(cls, v):
        if len(v.strip()) == 0:
            raise ValueError('Message cannot be empty')
        return v.strip()

# Chat message output
class ChatMessageOut(BaseModel):
    id: int
    alert_id: int
    sender_id: int
    receiver_id: int
    message: str
    message_type: str
    created_at: datetime
    read_at: Optional[datetime] = None
    is_mine: bool = False  # Set dynamically based on current user
    sender_name: Optional[str] = None
    sender_type: Optional[str] = None  # 'citizen' or 'police'
    
    class Config:
        from_attributes = True

# Chat summary for alerts list
class ChatSummary(BaseModel):
    total_messages: int
    unread_count: int
    last_message: Optional[str] = None
    last_message_time: Optional[datetime] = None

# ==================== SAFAWALK SCHEMAS ====================

class SafeWalkCreate(BaseModel):
    duration_minutes: int
    start_latitude: Optional[float] = None
    start_longitude: Optional[float] = None
    destination_name: Optional[str] = None

class SafeWalkUpdate(BaseModel):
    latitude: float
    longitude: float

class SafeWalkOut(BaseModel):
    id: int
    user_id: int
    start_time: datetime
    end_time: datetime
    status: str
    current_latitude: Optional[float]
    current_longitude: Optional[float]
    
    class Config:
        from_attributes = True
