from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Date, Boolean, Float
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    cnic = Column(String(13), unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # User type: 'citizen', 'police', 'admin'
    user_type = Column(String(20), default='citizen')
    
    # Approval status for police: 'pending', 'approved', 'rejected'
    approval_status = Column(String(20), default='approved')
    
    # Account status: 'active', 'suspended', 'deleted'
    account_status = Column(String(20), default='active')
    suspension_reason = Column(String(500), nullable=True)
    suspended_at = Column(DateTime(timezone=True), nullable=True)
    suspended_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Profile fields (extracted from CNIC via OCR)
    full_name = Column(String(255), nullable=True)
    father_name = Column(String(255), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(String(10), nullable=True)
    address = Column(Text, nullable=True)
    
    # Contact information
    email = Column(String(255), nullable=True)
    phone = Column(String(15), nullable=True)
    
    # Verification status
    email_verified = Column(Boolean, default=False)
    profile_complete = Column(Boolean, default=False)
    cnic_front_image = Column(String(500), nullable=True)
    cnic_back_image = Column(String(500), nullable=True)
    
    # Police-specific fields
    police_badge_number = Column(String(50), nullable=True)
    police_id_front_image = Column(String(500), nullable=True)
    police_id_back_image = Column(String(500), nullable=True)
    police_station = Column(String(255), nullable=True)
    police_rank = Column(String(100), nullable=True)
    
    # Location tracking
    last_latitude = Column(Float, nullable=True)
    last_longitude = Column(Float, nullable=True)
    last_location_update = Column(DateTime(timezone=True), nullable=True)
    
    # Expo push token for notifications
    push_token = Column(String(255), nullable=True)
    
    # Relationship to alerts (as sender)
    alerts = relationship("Alert", back_populates="user", foreign_keys="Alert.user_id")
    
    # Relationship to responses (as officer)
    responses = relationship("AlertResponse", back_populates="officer", foreign_keys="AlertResponse.officer_id")
    
    # Relationship to chat messages
    sent_messages = relationship("ChatMessage", back_populates="sender", foreign_keys="ChatMessage.sender_id")
    safe_walk_sessions = relationship("SafeWalkSession", back_populates="user")

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    alert_type = Column(String(20), nullable=False)  # 'sos', 'text', 'voice'
    content = Column(Text, nullable=True)
    audio_url = Column(String(500), nullable=True)  # Path to audio file for voice alerts
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Location of alert
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    
    # Alert tag: 'police', 'fire', 'ambulance', 'wildlife', 'other'
    tag = Column(String(50), nullable=True)
    
    # Alert status: 'pending', 'responded', 'resolved'
    status = Column(String(20), default='pending')
    
    # Transcription (for voice alerts)
    transcription = Column(Text, nullable=True)  # Full text from Whisper
    transcription_keywords = Column(Text, nullable=True)  # Comma-separated keywords
    transcription_status = Column(String(20), default='none')  # 'none', 'pending', 'completed', 'failed'
    
    # Responding officer
    responded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    responded_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationship to user (sender)
    user = relationship("User", back_populates="alerts", foreign_keys=[user_id])
    
    # Relationship to responding officer
    responding_officer = relationship("User", foreign_keys=[responded_by])
    
    # Relationship to responses
    responses = relationship("AlertResponse", back_populates="alert")
    
    # Relationship to chat messages
    messages = relationship("ChatMessage", back_populates="alert")

class AlertResponse(Base):
    """Tracks police officer responses to alerts"""
    __tablename__ = "alert_responses"
    
    id = Column(Integer, primary_key=True, index=True)
    alert_id = Column(Integer, ForeignKey("alerts.id", ondelete="CASCADE"), nullable=False)
    officer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    response_time = Column(DateTime(timezone=True), server_default=func.now())
    
    # Response status: 'en_route', 'arrived', 'resolved', 'cancelled'
    status = Column(String(20), default='en_route')
    
    # Officer location when they responded
    officer_latitude = Column(Float, nullable=True)
    officer_longitude = Column(Float, nullable=True)
    
    # Distance to alert in km
    distance_km = Column(Float, nullable=True)
    
    notes = Column(Text, nullable=True)
    
    # Relationships
    alert = relationship("Alert", back_populates="responses")
    officer = relationship("User", back_populates="responses", foreign_keys=[officer_id])

class ChatMessage(Base):
    """Chat messages between citizens and officers for an alert"""
    __tablename__ = "chat_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    alert_id = Column(Integer, ForeignKey("alerts.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    message = Column(Text, nullable=False)
    message_type = Column(String(20), default='text')  # 'text', 'auto', 'location', 'image'
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    read_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    alert = relationship("Alert", back_populates="messages")
    sender = relationship("User", back_populates="sent_messages", foreign_keys=[sender_id])

class SafeWalkSession(Base):
    """Live tracking session for Safe Walk feature"""
    __tablename__ = "safe_walk_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    start_time = Column(DateTime(timezone=True), server_default=func.now())
    end_time = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    status = Column(String(20), default='active')  # 'active', 'completed', 'emergency_triggered', 'cancelled'
    
    start_latitude = Column(Float, nullable=True)
    start_longitude = Column(Float, nullable=True)
    
    current_latitude = Column(Float, nullable=True)
    current_longitude = Column(Float, nullable=True)
    
    # Relationship
    user = relationship("User", back_populates="safe_walk_sessions")

# Update User model to include the relationship
# This is handled dynamically by SQLAlchemy usually, but good to be explicit if we edited User


class OTPStore(Base):
    """Temporary storage for OTPs"""
    __tablename__ = "otp_store"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), nullable=False, index=True)
    otp = Column(String(6), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
