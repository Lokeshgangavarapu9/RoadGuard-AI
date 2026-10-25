# RoadGuard AI — Production Deployment Guide

This document provides complete instructions for deploying the **RoadGuard AI** platform to production:
- **Frontend**: React + Vite deployed to **Vercel**
- **Backend**: Java 21 / Spring Boot 3.3.5 + ONNX Runtime container deployed to a **Java/Docker compatible host** (Render, Railway, or Google Cloud Run)
- **Database**: Managed **PostgreSQL** for journey, defect, and audit persistence
- **Evidence Storage**: Persistent disk volume for high-resolution road photographs

---

## 1. Architecture & Deployment Topology

```
+-------------------------------------------------------------------------+
|                              CITIZEN CLIENT                             |
|          Web Browser (Mobile PWA / Desktop Chrome, Edge, Safari)        |
+-------------------------------------------------------------------------+
                                    |
          +-------------------------+-------------------------+
          | HTTPS (Port 443)                                  | HTTPS (Port 443)
          v                                                   v
+-------------------------------+             +----------------------------------+
|            VERCEL             |             |          BACKEND HOST            |
|       (Static CDN Edge)       |             |   (Render / Railway / Cloud Run) |
|                               |             |                                  |
| Root Dir: roadguard-frontend  |             | Spring Boot 3.3.5 (Java 21 JRE)  |
| Build: npm run build          |             | Native ONNX Runtime YOLO11s      |
| SPA Rewrite: vercel.json      |  API Calls  | Port: ${PORT:-8080}              |
|                               | ----------> | Health: /api/v1/health           |
| Env:                          |  CORS:      |                                  |
|   VITE_API_BASE_URL=https://  |  *.vercel   +-----------------+----------------+
|     roadguard-api...          |               |               |
+-------------------------------+               | JDBC (TLS)    | Mount /app/uploads
                                                v               v
                                  +-------------------+  +-----------------------+
                                  |    POSTGRESQL     |  |   PERSISTENT VOLUME   |
                                  |  (Managed Cloud)  |  |   (10GB Block Disk)   |
                                  |                   |  |                       |
                                  | Journeys, Issues, |  | Raw Evidence Frames   |
                                  | Audits, Grievance |  | (JPEG road photos)    |
                                  +-------------------+  +-----------------------+
```

---

## 2. Frontend Deployment (Vercel)

### 2.1 Configuration Settings
When importing the GitHub repository (`https://github.com/Lokeshgangavarapu9/RoadGuard-AI`) into Vercel:

| Setting | Value | Notes |
| :--- | :--- | :--- |
| **Project Name** | `roadguard-ai` | Or your preferred name |
| **Framework Preset** | `Vite` | Detected automatically |
| **Root Directory** | `roadguard-frontend` | **CRITICAL**: Do NOT leave as repo root |
| **Build Command** | `npm run build` | Default |
| **Output Directory** | `dist` | Default |
| **Install Command** | `npm install` | Default |

### 2.2 SPA Routing Rewrite (`vercel.json`)
Because RoadGuard AI uses client-side routing, `roadguard-frontend/vercel.json` provides the rewrite rule:
```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### 2.3 Frontend Environment Variables
In the Vercel dashboard (**Project Settings** &rarr; **Environment Variables**):

| Variable Name | Example Value | Description |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `https://roadguard-backend.onrender.com` | Public HTTPS URL of your deployed Spring Boot backend (without trailing slash) |

> **Local Development Note**: If `VITE_API_BASE_URL` is omitted or empty, the frontend automatically falls back to relative paths, which Vite proxies to `http://localhost:8080`.

---

## 3. Backend Deployment (Spring Boot + ONNX Runtime)

### 3.1 Host Selection & Native Library Requirements
The backend uses **Microsoft ONNX Runtime Java** (`onnxruntime4j_jni.so`) to run the YOLO11s road-damage model locally inside the JVM.
- **MANDATORY**: The runtime environment **MUST use glibc** (Ubuntu or Debian base image).
- **INCOMPATIBLE**: Alpine Linux (`musl libc`) will throw an `UnsatisfiedLinkError` when ONNX loads native bindings.
- **DOCKER BASE**: The project provides a multi-stage `Dockerfile` using `eclipse-temurin:21-jre-jammy` (Ubuntu 22.04 LTS).

### 3.2 Recommended Hosting Providers

#### Option A: Render (Recommended Blueprint)
A ready-to-use `render.yaml` is provided in the repository root.
1. Connect your GitHub account to [Render](https://render.com).
2. Click **New +** &rarr; **Blueprint**.
3. Select `RoadGuard-AI`.
4. Render will automatically provision:
   - A managed **PostgreSQL** instance (`roadguard-postgres`)
   - A Docker web service (`roadguard-backend`) with dynamic `$PORT` and persistent disk storage for evidence photos.

#### Option B: Railway
1. Create a new project on [Railway](https://railway.app).
2. Add a **PostgreSQL** database.
3. Add a service from GitHub repo pointing to `roadguard-backend/Dockerfile`.
4. Add a Persistent Volume mounted at `/app/uploads`.
5. Connect PostgreSQL environment variables.

#### Option C: Google Cloud Run + Cloud SQL
1. Build and push the container image to Google Artifact Registry:
   ```bash
   gcloud builds submit --tag gcr.io/PROJECT_ID/roadguard-backend roadguard-backend
   ```
2. Deploy to Cloud Run with Cloud SQL connection:
   ```bash
   gcloud run deploy roadguard-backend \
     --image gcr.io/PROJECT_ID/roadguard-backend \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars ROADGUARD_CORS_ALLOWED_ORIGINS=https://roadguard-ai.vercel.app
   ```

### 3.3 Backend Dockerfile Architecture
The `roadguard-backend/Dockerfile` includes:
- **Build Stage**: Eclipse Temurin 21 JDK + Maven dependency caching.
- **Runtime Stage**: Eclipse Temurin 21 JRE Jammy (Ubuntu-based glibc).
- **Model Included**: Copies `models/road_damage_yolo.onnx` (36.1 MB) into `/app/models/`.
- **Health Check**: Native `curl -f http://localhost:${PORT:-8080}/api/v1/health`.
- **JVM Flags**: Runs with `--add-opens=java.base/java.lang=ALL-UNNAMED` for modern Java reflection.

---

## 4. Database & Evidence Storage Persistence

### 4.1 Production Database Blocker (H2 In-Memory)
> [!CAUTION]
> In local development, the backend defaults to H2 in-memory (`jdbc:h2:mem:roadguard`).
> **Never use H2 in-memory in production.** Any container restart or redeployment will destroy all journeys, defect records, and audit history.

### 4.2 PostgreSQL Production Setup
Set the following backend environment variables to connect to your production PostgreSQL database:
```env
SPRING_DATASOURCE_URL=jdbc:postgresql://<host>:5432/<dbname>
SPRING_DATASOURCE_USERNAME=<user>
SPRING_DATASOURCE_PASSWORD=<password>
SPRING_DATASOURCE_DRIVER_CLASS_NAME=org.postgresql.Driver
SPRING_JPA_DATABASE_PLATFORM=org.hibernate.dialect.PostgreSQLDialect
SPRING_FLYWAY_ENABLED=true
SPRING_FLYWAY_BASELINE_ON_MIGRATE=true
```
The application includes `org.postgresql:postgresql` and `flyway-database-postgresql` drivers. Flyway will automatically run baseline migrations on startup.

### 4.3 Evidence Storage Volume
Road defect complaint verification requires high-resolution camera images.
- Local uploads are written to `ROADGUARD_UPLOAD_DIR` (default: `/app/uploads/evidence`).
- Mount a persistent volume to `/app/uploads` on your hosting provider so that uploaded images survive container redeployments.

---

## 5. Network Security & CORS Configuration

RoadGuard AI implements strict CORS validation across both Spring Security and Spring MVC:
- **Allowed Origins**: `https://*.vercel.app`, `http://localhost:5173`, and your custom production domain.
- **Wildcard Policy**: `*` origin with credentials is **strictly prohibited** to prevent cross-site request forgery and data leakage.
- **Preflight Support**: Explicit HTTP `OPTIONS` requests are permitted for all API endpoints (`/api/**`) and evidence asset endpoints (`/uploads/**`).
- **Exposed Headers**: `Authorization`, `Content-Type`, `X-Requested-With`, `Accept`.

To add a custom production domain, update the `ROADGUARD_CORS_ALLOWED_ORIGINS` environment variable:
```env
ROADGUARD_CORS_ALLOWED_ORIGINS=https://roadguard.yourdomain.com,https://*.vercel.app
```

---

## 6. Complete Environment Variables Reference

### Frontend Variables (Vercel)
| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `VITE_API_BASE_URL` | **Yes** | `""` (relative) | Backend HTTPS origin (e.g., `https://api.roadguard.ai`) |

### Backend Variables (Java Host)
| Variable | Required in Prod | Default | Description |
| :--- | :---: | :--- | :--- |
| `PORT` | Auto | `8080` | Web server port (set automatically by Render / Cloud Run) |
| `SPRING_DATASOURCE_URL` | **Yes** | `jdbc:h2:mem:...` | PostgreSQL JDBC connection string |
| `SPRING_DATASOURCE_USERNAME` | **Yes** | `sa` | PostgreSQL database user |
| `SPRING_DATASOURCE_PASSWORD` | **Yes** | `""` | PostgreSQL database password |
| `SPRING_DATASOURCE_DRIVER_CLASS_NAME`| **Yes** | `org.h2.Driver` | `org.postgresql.Driver` |
| `SPRING_JPA_DATABASE_PLATFORM` | **Yes** | `org.hibernate...H2Dialect` | `org.hibernate.dialect.PostgreSQLDialect` |
| `SPRING_FLYWAY_ENABLED` | No | `true` | Runs database migrations |
| `ROADGUARD_CORS_ALLOWED_ORIGINS` | **Yes** | `localhost,*.vercel.app` | Comma-separated allowed frontend origins |
| `ROADGUARD_UPLOAD_DIR` | No | `./uploads/evidence` | Disk directory for evidence images |
| `ROADGUARD_MODEL_PATH` | No | `models/road_damage_yolo.onnx`| Path to YOLO11s ONNX weights |
| `H2_CONSOLE_ENABLED` | No | `false` | Must remain `false` in production |

---

## 7. Step-by-Step Deployment Walkthrough

### Step 1: Deploy Backend & Database
1. Push all latest changes to GitHub: `git push origin main`.
2. Open [Render.com](https://render.com) (or Railway/Cloud Run).
3. Create a **New Blueprint Instance** and select `Lokeshgangavarapu9/RoadGuard-AI`.
4. Wait for PostgreSQL and the Docker container to build and become healthy.
5. Copy your public backend URL: `https://roadguard-backend-xxxx.onrender.com`.
6. Test backend health:
   ```bash
   curl -i https://roadguard-backend-xxxx.onrender.com/api/v1/health
   ```
   Expected response: `{"status":"UP","activeJourneys":0,...}`

### Step 2: Deploy Frontend on Vercel
1. Log in to [Vercel](https://vercel.com).
2. Click **Add New...** &rarr; **Project**.
3. Import `Lokeshgangavarapu9/RoadGuard-AI`.
4. Set **Root Directory** to `roadguard-frontend`.
5. Under **Environment Variables**, add:
   - `VITE_API_BASE_URL` = `https://roadguard-backend-xxxx.onrender.com`
6. Click **Deploy**.
7. Once deployed, open your `https://roadguard-xxxx.vercel.app` URL.

### Step 3: End-to-End Verification
1. Open the Vercel site in your browser.
2. Verify system health indicator turns green (**System Online**).
3. Start a journey in **Live Monitoring** mode.
4. Verify GPS telemetry updates and evidence uploads communicate with the backend over HTTPS.
5. Navigate to **Journey Reports** and verify that 2D route map, defect badges, and captured photos load seamlessly.
