import smtplib
import random
import string
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from dotenv import load_dotenv

load_dotenv()

class EmailService:
    def __init__(self):
        self.smtp_host = os.getenv('SMTP_HOST', 'smtp.gmail.com')
        self.smtp_port = int(os.getenv('SMTP_PORT', 465))
        self.smtp_user = os.getenv('SMTP_USER')
        self.smtp_password = os.getenv('SMTP_PASSWORD')
        self.from_email = os.getenv('FROM_EMAIL', self.smtp_user)
    
    def generate_otp(self) -> str:
        """Generate 6-digit OTP"""
        return ''.join(random.choices(string.digits, k=6))
    
    def send_otp_email(self, to_email: str, otp: str) -> bool:
        """
        SIMULATION MODE: Print OTP to Console (Render Free Tier Workaround)
        Render blocks SMTP ports 25, 465, 587 on Free Tier.
        To verify, check the Render Logs for the OTP.
        """
        print(f"\n{'='*50}")
        print(f"📧 EMAIL SIMULATION - TO: {to_email}")
        print(f"🔑 OTP CODE: {otp}")
        print(f"{'='*50}\n")
        
        # We return True to simulate success to the frontend
        return True


# Singleton instance
email_service = EmailService()
