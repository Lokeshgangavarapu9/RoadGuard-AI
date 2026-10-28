# RoadGuard AI — Bug Fix Report: Startup Conflict & CORS Resolution

**Date:** 2026-10-25  
**Project:** RoadGuard AI (`C:\Users\LOKESH\java project 2026`)  
**Backend:** Spring Boot 3.3.5, Java 26, Maven (`roadguard-backend`)  
**Frontend:** React 18, Vite 8 (`roadguard-frontend`)  

---

## 1. Problem 1: Backend Startup Conflict (Port 8080 in use)

### 1.1 Symptoms & Root Cause

* **Symptom:** Terminal output:

  ```text
  APPLICATION FAILED TO START
  Web server failed to start. Port 8080 was already in use.
  ```

* **Investigation:**
  Ran `Get-NetTCPConnection -LocalPort 8080 -State Listen` and checked process details:
  * LocalPort: `8080`
  * OwningProcess: `31116` (`java.exe`)
  * Running command line: `RoadGuardApplication`
  * Health check at `http://localhost:8080/api/v1/health` returned:

    ```json
    {
      "status": "UP",
      "database": "H2_IN_MEMORY (Stage A)",
      "inferenceMode": "ONNX",
      "storageType": "local",
      "version": "0.1.0-STAGE-A",
      "modelStatus": "LOADED",
      "modelPath": "./models/road_damage_yolo.onnx"
    }
    ```

* **Root Cause:** A RoadGuard backend instance was already running on port 8080 from a previous session or terminal. Attempting to start a second backend instance via `mvn spring-boot:run` without stopping or reusing the running instance caused Tomcat's port binding collision.

### 1.2 Resolution & Best Practice for Starting Backend

1. **Always verify port 8080 before launching a new backend process:**

   ```powershell
   Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue
   ```

2. **If already healthy, reuse it:**

   ```powershell
   Invoke-RestMethod "http://localhost:8080/api/v1/health"
   ```

   If status is `UP`, do not run another instance; the backend is ready.
3. **If code changes require a restart:**
   Stop only the identified Java process running RoadGuard:

   ```powershell
   $proc = (Get-NetTCPConnection -LocalPort 8080 -State Listen).OwningProcess
   Stop-Process -Id $proc -Force
   Start-Sleep -Seconds 2
   .\mvnw.cmd spring-boot:run "-Dspring-boot.run.jvmArguments=--add-opens=java.base/java.lang=ALL-UNNAMED"
   ```

---

## 2. Problem 2: Invalid CORS Request on Journey Creation

### 2.1 Symptoms & Root Cause

* **Symptom:** Browser alerted:

  ```text
  Could not start journey: Invalid CORS request
  ```

  when using the application at `http://localhost:5174`.
* **Investigation of Frontend & Proxy:**
  * `roadguard-frontend/src/api.js` defines `const API_BASE = '/api/v1'`. It correctly calls relative URLs (e.g. `/api/v1/journeys`).
  * `roadguard-frontend/vite.config.js` configures the Vite proxy:

    ```javascript
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': { target: 'http://localhost:8080', changeOrigin: true },
        '/uploads': { target: 'http://localhost:8080', changeOrigin: true }
      }
    }
    ```

  * When port `5173` was already bound (by an earlier background process), Vite automatically selected port `5174` for the new frontend instance.
  * In modern browsers, all state-modifying requests (`POST`, `PUT`, `DELETE`) automatically attach the `Origin` header (`Origin: http://localhost:5174`), even when routed through a local dev server proxy.
  * Vite's proxy changes the `Host` header to `localhost:8080` (via `changeOrigin: true`), but deliberately preserves the client's `Origin: http://localhost:5174` header.
* **Investigation of Backend CORS:**
  * `application.properties` previously configured:

    ```properties
    roadguard.cors.allowed-origins=${CORS_ORIGINS:http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173}
    ```

  * In `SecurityConfig.java`, `CorsConfiguration.setAllowedOrigins` only loaded the origins above. Port `5174` was completely missing.
  * When Spring's `DefaultCorsProcessor` received `Origin: http://localhost:5174`, it matched against the allowed origins list. Since `http://localhost:5174` was absent, it rejected the request with:
    * HTTP Status: `403 Forbidden`
    * Response Body: `Invalid CORS request`

---

## 3. Exact Code Changes Implemented

### 3.1 `roadguard-backend/src/main/resources/application.properties`

Updated `roadguard.cors.allowed-origins` to include all standard local Vite development ports (5173, 5174, 5175, 3000 on both `localhost` and `127.0.0.1`):

```properties
# ── CORS ──────────────────────────────────────────────────────
# Frontend origins allowed to call the backend
roadguard.cors.allowed-origins=${CORS_ORIGINS:http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:5175}
```

### 3.2 `roadguard-backend/src/main/java/com/roadguard/api/config/SecurityConfig.java`

* Updated default `@Value` for `allowedOrigins` to include `5174`, `5175`, `127.0.0.1:5174`, etc.
* Added explicit permit for preflight `OPTIONS` requests:

  ```java
  .requestMatchers(org.springframework.http.HttpMethod.OPTIONS, "/**").permitAll()
  ```

* Explicitly configured allowed methods and allowed headers:

  ```java
  config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
  config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "X-Requested-With", "Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"));
  config.setExposedHeaders(List.of("Content-Disposition", "X-Request-Id"));
  config.setAllowCredentials(true);
  config.setMaxAge(3600L);
  ```

* Registered CORS mapping for both `/api/**` and `/uploads/**` (ensuring evidence images can be loaded cross-origin).
* Preserved `allowCredentials(true)` with strict explicit origins (no wildcards).

### 3.3 `roadguard-backend/src/main/java/com/roadguard/api/config/WebConfig.java`

* Implemented `WebMvcConfigurer.addCorsMappings` matching the exact same allowed origins, methods, headers, and paths as Spring Security, guaranteeing consistency between the servlet filter chain and MVC dispatcher mappings.

---

## 4. Verification & Testing Performed

### 4.1 Backend Health Verification

* `GET http://localhost:8080/api/v1/health`

  ```json
  {
    "status": "UP",
    "database": "H2_IN_MEMORY (Stage A)",
    "inferenceMode": "ONNX",
    "storageType": "local",
    "version": "0.1.0-STAGE-A",
    "modelStatus": "LOADED",
    "modelPath": "./models/road_damage_yolo.onnx"
  }
  ```

### 4.2 CORS Preflight Verification (Port 5174)

* Sent `OPTIONS /api/v1/journeys` with `Origin: http://localhost:5174` and `Access-Control-Request-Method: POST`:
  * **Status:** `HTTP/1.1 200 OK`
  * **Headers:**
    * `Access-Control-Allow-Origin: http://localhost:5174`
    * `Access-Control-Allow-Credentials: true`
    * `Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS`

### 4.3 Journey Creation & Telemetry via Port 5174 (Vite Proxy)

* **POST `/api/v1/journeys` via `http://localhost:5174`:**
  * **Result:** `HTTP 200 OK`
  * Created Journey `#1` (`UUID: 7a67e778-a6ae-4613-a15a-8847d631dd00`, `status: ACTIVE`).
* **POST `/api/v1/journeys/1/gps` via `http://localhost:5174`:**
  * **Result:** `HTTP 200 OK`
  * Added GPS point sequence `1` (`lat: 16.5065`, `lon: 80.6482`, `speed: 13.3 km/h`).
* **POST `/api/v1/journeys/1/stop` via `http://localhost:5174`:**
  * **Result:** `HTTP 200 OK`
  * Stopped Journey `#1` with distance `250.0m`, `status: STOPPED`.

### 4.4 Same Journey Creation via Port 5173

* **POST `/api/v1/journeys` via `http://localhost:5173`:**
  * Created Journey `#2` (`status: ACTIVE`).
  * Confirmed both ports 5173 and 5174 work seamlessly.

### 4.5 Backend Test Suite

Executed `mvn test`:

* `OnnxInferenceRunnerTest`: 4 tests run, 0 failures, 0 errors.
* `OnnxModelInspectTest`: 1 test run, 0 failures, 0 errors.
* **Overall:** 5 tests run, 0 failures, 0 errors. **BUILD SUCCESS**.

### 4.6 Frontend Production Build

Executed `npm run build` in `roadguard-frontend`:

* 2,190 modules transformed.
* Bundle output generated in `dist/`.
* **Status:** Clean build with 0 errors.

### 4.7 Browser Automation Limitation Note

Playwright automated browser driver download returned 404 from upstream CDN (`playwright-1.57.0-win32_x64.zip`). In accordance with testing integrity instructions, end-to-end HTTP tests were conducted directly against the live Vite proxy servers (`http://localhost:5174` and `http://localhost:5173`) and the Spring Boot backend (`http://localhost:8080`).

---

## 5. Remaining Considerations

* No remaining blockers for Stage A development.
* In Stage B, when external authentication (JWT) is enabled (`roadguard.security.auth-enabled=true`), the CORS configuration remains intact and ready for credentials.
