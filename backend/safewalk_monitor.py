import time
import threading
from datetime import datetime, timezone
import models
from database import SessionLocal

def monitor_safe_walk_sessions():
    """
    Background loop to check for expired Safe Walk sessions.
    If a session expires (current_time > end_time) and is still 'active',
    it triggers an emergency alert.
    """
    print("🛡️  Safe Walk Monitor Started")
    while True:
        try:
            db = SessionLocal()
            now = datetime.now(timezone.utc)
            
            # Find expired active sessions
            expired_sessions = db.query(models.SafeWalkSession).filter(
                models.SafeWalkSession.status == 'active',
                models.SafeWalkSession.end_time < now
            ).all()
            
            for session in expired_sessions:
                print(f"🚨 Safe Walk Expired for User {session.user_id}. Triggering Alert!")
                
                # Update status
                session.status = 'emergency_triggered'
                
                # Create Emergency Alert
                new_alert = models.Alert(
                    user_id=session.user_id,
                    alert_type='sos',
                    content="Safe Walk timer expired. User did not check in.",
                    latitude=session.current_latitude or session.start_latitude,
                    longitude=session.current_longitude or session.start_longitude,
                    tag='police',
                    status='pending',
                    transcription_status='none'
                )
                db.add(new_alert)
                
                # In a real app, we would also trigger SMS/Push notifications here
            
            db.commit()
            db.close()
            
        except Exception as e:
            print(f"Error in Safe Walk Monitor: {e}")
        
        # Check every 30 seconds
        time.sleep(30)

def start_monitor():
    thread = threading.Thread(target=monitor_safe_walk_sessions, daemon=True)
    thread.start()
