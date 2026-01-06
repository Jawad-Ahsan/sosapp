from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from dotenv import load_dotenv
from . import models, database
from .routers import auth, users, alerts, chat, admin, safewalk
from . import safewalk_monitor
from .socket_manager import sio
import socketio

load_dotenv()

models.Base.metadata.create_all(bind=database.engine)

fastapi_app = FastAPI(title="SOS App API", version="4.0")

# CORS middleware
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
# Include Routers
fastapi_app.include_router(auth.router)
fastapi_app.include_router(users.router)
fastapi_app.include_router(alerts.router)
fastapi_app.include_router(chat.router)
fastapi_app.include_router(admin.router)
fastapi_app.include_router(safewalk.router)

# Wrap with Socket.IO
app = socketio.ASGIApp(sio, fastapi_app)

# Start Safe Walk Monitor
@fastapi_app.on_event("startup")
def startup_event():
    safewalk_monitor.start_monitor()

@fastapi_app.get("/")
def read_root():
    return {"message": "SOSApp Backend is running", "version": "4.0"}

# Serve uploaded images (Global static file serving)
@fastapi_app.get("/uploads/{path:path}")
async def serve_upload(path: str):
    file_path = Path("uploads") / path
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)
