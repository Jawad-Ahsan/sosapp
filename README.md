# 🛡️ SOS App - Personal Safety System

**SOS App** is a comprehensive personal safety solution designed to provide immediate assistance in emergencies. It bridges the gap between users in distress and emergency responders (Police/Admins) through real-time technology.

## 🚀 Key Features

*   **🚨 Instant SOS Alerts**: One-tap emergency signaling that notifies nearby officers and admins immediately.
*   **📍 Real-Time Tracking (SafeWalk)**: Live location monitoring to ensure users reach their destinations safely.
*   **💬 Live Chat**: Integrated real-time chat for communication between victims and responders.
*   **🎙️ Audio Evidence**: Automatically records and uploads voice notes during emergencies.
*   **👮 Multi-User Support**: Dedicated interfaces for Public users, Police officers, and Administrators.
*   **🔐 Secure Authentication**: CNIC-based login with police verification workflow and JWT security.

## 🛠️ Tech Stack

*   **Frontend**: React Native (Expo), Socket.IO Client, Google Maps API.
*   **Backend**: Python FastAPI, Socket.IO (Async), SQLAlchemy.
*   **Database**: PostgreSQL (with PostGIS support).
*   **Storage**: Local/Cloud file storage for media evidence.

## 📱 Screenshots

| Dashboard | SafeWalk | Emergency Alert |
|:---:|:---:|:---:|
| *(Add screenshot)* | *(Add screenshot)* | *(Add screenshot)* |

## 🔧 Installation

1.  **Clone the Repo**
    ```bash
    git clone https://github.com/StartWars1/sosapp.git
    cd sosapp
    ```

2.  **Backend Setup**
    ```bash
    cd backend
    pip install -r ../requirements.txt
    uvicorn main:fastapi_app --reload
    ```

3.  **Frontend Setup**
    ```bash
    npm install
    npx expo start
    ```

## 🤝 Contributing
Contributions are welcome! Please fork the repository and submit a pull request.
