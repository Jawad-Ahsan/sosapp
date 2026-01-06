import socketio

# Create a Socket.IO server capable of handling async requests
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
app = socketio.ASGIApp(sio)

@sio.event
async def connect(sid, environ):
    print(f"Socket Connected: {sid}")

@sio.event
async def disconnect(sid):
    print(f"Socket Disconnected: {sid}")

@sio.event
async def join_room(sid, room):
    """Allow clients to join specific rooms (e.g., 'user_1', 'police_all')"""
    await sio.enter_room(sid, room)
    print(f"Socket {sid} joined room {room}")

@sio.event
async def leave_room(sid, room):
    await sio.leave_room(sid, room)
    print(f"Socket {sid} left room {room}")
