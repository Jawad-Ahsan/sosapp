"""
Database Reset Script
Run this to recreate all tables with the new schema.
Warning: This will delete all existing data!
"""
import sys
sys.path.append('.')

from database import engine, Base
import models

def reset_database():
    print("Dropping all existing tables...")
    Base.metadata.drop_all(bind=engine)
    print("Creating all tables with new schema...")
    Base.metadata.create_all(bind=engine)
    print("Database reset complete!")
    
    # Create default admin user
    from sqlalchemy.orm import Session
    from passlib.context import CryptContext
    
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    with Session(engine) as db:
        # Check if admin already exists
        admin = db.query(models.User).filter(models.User.cnic == "0000000000000").first()
        if not admin:
            admin = models.User(
                cnic="0000000000000",
                password_hash=pwd_context.hash("admin123"),
                user_type="admin",
                approval_status="approved",
                full_name="System Admin",
                profile_complete=True,
                email_verified=True
            )
            db.add(admin)
            db.commit()
            print("Default admin user created:")
            print("  CNIC: 0000000000000")
            print("  Password: admin123")
            print("  (Change this password immediately!)")
        else:
            print("Admin user already exists.")

if __name__ == "__main__":
    confirm = input("This will DELETE ALL DATA. Type 'yes' to confirm: ")
    if confirm.lower() == 'yes':
        reset_database()
    else:
        print("Aborted.")
