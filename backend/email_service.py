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
        """Send OTP to user's email"""
        msg = MIMEMultipart('alternative')
        msg['From'] = self.from_email
        msg['To'] = to_email
        msg['Subject'] = 'SOS App - Email Verification OTP'
        
        # Plain text version
        text_body = f"""
SOS App - Email Verification

Your OTP for email verification is: {otp}

This OTP is valid for 10 minutes.

If you did not request this, please ignore this email.

- SOS App Team
        """
        
        # HTML version
        html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; }}
        .container {{ max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        .header {{ text-align: center; color: #d9534f; margin-bottom: 20px; }}
        .otp-box {{ background: linear-gradient(135deg, #1a1a2e, #16213e); color: white; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; border-radius: 10px; letter-spacing: 8px; margin: 20px 0; }}
        .info {{ color: #666; font-size: 14px; text-align: center; }}
        .footer {{ margin-top: 30px; text-align: center; color: #999; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <h1 class="header">🚨 SOS App</h1>
        <p style="text-align: center; color: #333;">Your Email Verification Code</p>
        <div class="otp-box">{otp}</div>
        <p class="info">This code is valid for <strong>10 minutes</strong>.</p>
        <p class="info">If you did not request this verification, please ignore this email.</p>
        <div class="footer">
            <p>SOS App - Your Safety, Our Priority</p>
        </div>
    </div>
</body>
</html>
        """
        
        msg.attach(MIMEText(text_body, 'plain'))
        msg.attach(MIMEText(html_body, 'html'))
        
        try:
            print(f"Connecting to SMTP server: {self.smtp_host}:{self.smtp_port}")
            # Use SMTP_SSL for port 465 (Implicit SSL)
            with smtplib.SMTP_SSL(self.smtp_host, self.smtp_port) as server:
                # server.starttls()  # NOT needed for SMTP_SSL
                print(f"Logging in as: {self.smtp_user}")
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)
                print(f"OTP email sent successfully to: {to_email}")
            return True
        except smtplib.SMTPAuthenticationError as e:
            print(f"SMTP Authentication failed: {e}")
            return False
        except smtplib.SMTPException as e:
            print(f"SMTP error: {e}")
            return False
        except Exception as e:
            print(f"Email sending failed: {e}")
            return False


# Singleton instance
email_service = EmailService()
