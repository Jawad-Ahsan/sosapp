import requests
import time
import sys

# Configuration
API_URL = "http://127.0.0.1:8000"
CNIC = "1111111111111"  # Need a valid user CNIC, will use a test one or signUp first
PASSWORD = "password123"

def print_step(step):
    print(f"\n[STEP] {step}")

def test_safe_walk():
    print("🚀 Starting Safe Walk Test...")
    
    # 1. Login
    print_step("Logging in...")
    login_data = {"cnic": CNIC, "password": PASSWORD, "user_type": "citizen"}
    try:
        # Try to register first just in case
        requests.post(f"{API_URL}/signup", json=login_data)
    except: pass
    
    response = requests.post(f"{API_URL}/login", json=login_data)
    if response.status_code != 200:
        print("❌ Login Failed", response.text)
        return
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("✅ Login Successful")

    # 2. Start Safe Walk (1 minute duration)
    print_step("Starting Safe Walk (1 min)...")
    start_data = {"duration_minutes": 1, "start_latitude": 33.6844, "start_longitude": 73.0479}
    response = requests.post(f"{API_URL}/safewalk/start", json=start_data, headers=headers)
    if response.status_code != 201:
        print("❌ Start Failed", response.text)
        # Try to end existing if found
        return
    
    session = response.json()
    session_id = session['id']
    print(f"✅ Safe Walk Started. ID: {session_id}, End Time: {session['end_time']}")

    # 3. Check-in (Update Location)
    print_step("Sending Heartbeat/Check-in...")
    loc_data = {"latitude": 33.6845, "longitude": 73.0480}
    response = requests.post(f"{API_URL}/safewalk/{session_id}/checkin", json=loc_data, headers=headers)
    if response.status_code == 200:
        print("✅ Check-in Successful")
    else:
        print("❌ Check-in Failed", response.text)

    # 4. Wait for expiration (Mocking time skip or actually waiting?)
    # Since we can't easily mock server time without restarting it, we'll manually triggering PANIC to test alert generation
    # effectively testing the "Active -> Emergency" transition logic.
    
    print_step("Testing Panic Button...")
    response = requests.post(f"{API_URL}/safewalk/{session_id}/panic", headers=headers)
    if response.status_code == 200:
        print("✅ Panic Button Works! Alert Generated.")
        alert_id = response.json()['alert_id']
        print(f"   Alert ID: {alert_id}")
    else:
        print("❌ Panic Button Failed", response.text)

    # Verify Alert Exists
    print_step("Verifying Alert in Database...")
    response = requests.get(f"{API_URL}/alerts", headers=headers)
    alerts = response.json()
    found = False
    for a in alerts:
        if a['content'] == "Panic button pressed during Safe Walk.":
            print(f"✅ Found Alert: {a['content']} (ID: {a['id']})")
            found = True
            break
    
    if not found:
        print("❌ Alert not found in list")

    print("\n🎉 Test Completed!")

if __name__ == "__main__":
    test_safe_walk()
