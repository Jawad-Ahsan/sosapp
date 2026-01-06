# ☁️ Free Cloud Deployment Guide for SOSApp

This guide will help you deploy your **FastAPI Backend** and **PostgreSQL Database** to the cloud for free, so your APK can work anywhere (4G/5G/Friends' houses).

**The Stack we will use:**
*   **Database**: Neon (Best free PostgreSQL tier, doesn't expire)
*   **Backend**: Render (Excellent free web hosting for Python)
*   **Frontend**: Expo (Your APK)

---

## Part 1: Prepare Your Code 🛠️

I have already created a `requirements.txt` file in your project root. This tells the cloud server what to install.

1.  **Push your code to GitHub**
    *   If you haven't already, creating a GitHub repository is essential.
    *   Create a repo on [github.com](https://github.com/new).
    *   Run these commands in your VS Code terminal (if not already linked):
        ```bash
        git init
        git add .
        git commit -m "Ready for deploy"
        git branch -M main
        git remote add origin https://github.com/YOUR_USERNAME/sosapp.git
        git push -u origin main
        ```

---

## Part 2: Set up the Database (Neon) 🗄️

1.  Go to [neon.tech](https://neon.tech) and Sign Up (Free).
2.  Create a **New Project**.
3.  It will give you a **Connection String** that looks like this:
    `postgres://user:password@ep-cool-site.us-east-2.aws.neon.tech/neondb?sslmode=require`
4.  **Copy this string**. You will need it in the next step.

---

## Part 3: Deploy Backend (Render) 🚀

1.  Go to [render.com](https://render.com) and Sign Up.
2.  Click **New +** -> **Web Service**.
3.  Connect your **GitHub** account and select your `sosapp` repository.
4.  **Configure the Service**:
    *   **Name**: `sosapp-backend`
    *   **Region**: Singapore or Frankfurt (Closer to Pakistan is better, but US is fine too).
    *   **Runtime**: **Python 3**
    *   **Build Command**: `pip install -r requirements.txt`
    *   **Start Command**: `uvicorn backend.main:fastapi_app --host 0.0.0.0 --port 10000`
5.  **Environment Variables**:
    Scroll down to "Environment Variables" and add these:
    *   `DB_HOST`: (From Neon string, e.g., `ep-cool-site...neon.tech`)
    *   `DB_NAME`: `neondb` (Default in Neon)
    *   `DB_USER`: (From Neon string)
    *   `DB_PASSWORD`: (From Neon string)
    *   `DB_PORT`: `5432`
    *   `SECRET_KEY`: `supersecretkey123` (Or make up a complex one)
    *   `ALGORITHM`: `HS256`
    *   `PYTHON_VERSION`: `3.9.0` (Optional, good for stability)
6.  Click **Create Web Service**.

**Wait for it to finish.** When you see "Your service is live", copy the URL (e.g., `https://sosapp-backend.onrender.com`).

---

## Part 4: Update Your App 📱

Now point your App to the cloud instead of your laptop.

**1.  Edit `src/config.js`:**
Replace your local IP with your real Cloud URL.

```javascript
// DELETE THIS: const API_URL = 'http://192.168.10.16:8000';
const API_URL = 'https://sosapp-backend.onrender.com'; // Use YOUR Render URL

export default API_URL;
```

**2.  Rebuild the APK:**
Since the code changed, you must rebuild the APK.

```poweshell
eas build --platform android --profile preview
```

---

## 🎉 Done!
Download the new APK. It will now work on **mobile data** and **any Wi-Fi network**.
