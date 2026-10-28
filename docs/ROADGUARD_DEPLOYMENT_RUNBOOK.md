# RoadGuard AI — Production Deployment & Synchronization Runbook

**Environment**:
* Frontend: Vercel (`https://roadguard-frontend.vercel.app`)
* Backend: Render Web Service (`https://roadguard-ai-tael.onrender.com`)
* Database: Managed PostgreSQL (Render)
* Storage: Local / S3-compatible persistent disk for evidence photos (`./uploads/evidence`)

---

## 1. Deployed Backend Synchronization (Resolving HTTP 400 on Render)

### The Defect
Render's deployed container returned `HTTP 400 Bad Request` on `GET /api/v1/complaints/confirmed-history` because the running container bytecode preceded commit `a58f174`. In the older container, Spring MVC evaluated the wildcard `@GetMapping("/{id}")` before `/confirmed-history`, throwing `MethodArgumentTypeMismatchException` when converting the string `"confirmed-history"` to a `Long`.

### The Resolution
In commit `a58f174`, `ComplaintController.java` was updated to:
1. Constrain single-complaint lookups to digits: `@GetMapping("/{id:[0-9]+}")`.
2. Explicitly map `@GetMapping("/confirmed-history")` before numeric paths.
3. Return `HTTP 200 OK` with an empty JSON array `[]` when no confirmed complaints exist.

### Steps to Synchronize Render:
1. Open the [Render Dashboard](https://dashboard.render.com).
2. Navigate to the **roadguard-ai-tael** Web Service.
3. Verify that the tracking branch is set to `main`.
4. Click **Manual Deploy** -> **Clear build cache & deploy**.
5. After deployment completes (~3–5 minutes), verify via curl or browser:
   ```bash
   curl -i https://roadguard-ai-tael.onrender.com/api/v1/complaints/confirmed-history
   ```
   **Expected Response**:
   ```http
   HTTP/2 200
   content-type: application/json
   []
   ```

---

## 2. Frontend Vercel Deployment

Vercel automatically builds and deploys from GitHub `main`.
* **Build Command**: `npm run build`
* **Output Directory**: `dist`
* **Node Version**: 20.x or 22.x
* Verify that `VITE_API_BASE_URL` in Vercel environment variables points to:
  `https://roadguard-ai-tael.onrender.com/api/v1`

---

## 3. Rollback Protocol

If a production regression occurs:
1. **Frontend Rollback**: In the Vercel dashboard, click **Deployments**, locate the last healthy deployment prior to the release, and click **Promote to Production** (instant zero-downtime rollback).
2. **Backend Rollback**: In the Render dashboard, click **Rollback** to revert to the previous container build artifact.
3. **Git Revert**: Execute `git revert HEAD --no-edit` and push to `main`.
