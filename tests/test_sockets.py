import socketio
import asyncio
import requests

# Configuration
API_URL = "http://127.0.0.1:8000"
SOCKET_URL = "http://127.0.0.1:8000" # socketio might need base url

# Create async socket client
sio = socketio.AsyncClient()

@sio.event
async def connect():
    print("✅ [TEST] Socket Connected!")
    await sio.emit('join_room', 'police_all')
    print("✅ [TEST] Joined 'police_all' room")

@sio.event
async def new_alert(data):
    print(f"⚡ [TEST] Received 'new_alert' event: {data}")
    await sio.disconnect()

@sio.event
async def disconnect():
    print("✅ [TEST] Socket Disconnected")

async def test_socket_flow():
    # 1. Connect
    print("[TEST] Connecting to Socket...")
    try:
        await sio.connect(SOCKET_URL)
        # socketio_path defaults to 'socket.io' which matches our new wrapper
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return

    # 2. Trigger an Alert via REST API (which should emit event)
    print("[TEST] Triggering REST API to create alert...")
    # Need a user token first
    try:
        login_resp = requests.post(f"{API_URL}/login", json={"cnic": "1111111111111", "password": "password123", "user_type": "citizen"})
        token = login_resp.json()['access_token']
        
        requests.post(
            f"{API_URL}/alerts", 
            json={"alert_type": "sos", "content": "Socket Test Alert", "tag": "police"},
            headers={"Authorization": f"Bearer {token}"}
        )
    except Exception as e:
        print(f"❌ API Request failed: {e}")
    
    # Wait for event
    await asyncio.sleep(5)
    if sio.connected:
        print("⚠️ Event might have been missed or not sent.")
        await sio.disconnect()

if __name__ == "__main__":
    asyncio.run(test_socket_flow())
