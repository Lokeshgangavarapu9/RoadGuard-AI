# RoadGuard AI — Profile & Government Portal Requirements Architecture

## 1. Executive Summary

RoadGuard AI's **My Profile & Connected Services** subsystem acts as the secure, authenticated data source for citizen identity and jurisdiction information needed to prepare, validate, and file road-damage grievances through Indian government grievance portals.

The profile strictly separates **static citizen identity and civic jurisdiction** from **transient road-damage telemetry and inspection evidence** (GPS coordinates, chainage, surface photos, pothole depth, severity classification).

---

## 2. Supported Government Portals & Requirements Matrix

| Portal Identifier | Official Portal Name & Authority | Official Source Consulted | Authentication Method | Required Profile Fields | Required Complaint Context | Verification Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `RAJMARGYATRA_NHAI` | RajmargYatra / National Highways Authority of India (NHAI) | Ministry of Road Transport and Highways (MoRTH) / NHAI Citizen Portal (`https://morth.nic.in` & RajmargYatra mobile app guidelines) | 10-Digit Mobile Number + SMS OTP | Full Legal Name, 10-Digit Mobile Number | GPS Lat/Lng, NH Number, Mile Marker/Chainage, Defect Photo, Defect Description | **Verified Structure** (Live filing requires citizen SMS OTP handoff) |
| `AP_CDMA` | Puramithra / Andhra Pradesh Commissioner & Director of Municipal Administration | AP Urban Development Department (`https://cdma.ap.gov.in`) | Mobile OTP / Citizen Registration | Full Legal Name, Mobile Number, Municipality / ULB Name | Road Location, Ward Number (if known), Road Surface Photo, Pothole Description | **Verified Structure** (Live filing requires municipal routing & citizen OTP) |
| `AP_MEEKOSAM_PGRS` | Mee Kosam / Public Grievance Redressal System (PGRS) | AP Government Citizen Services (`https://meekosam.ap.gov.in`) | Aadhaar / Mobile + BotDetect Visual CAPTCHA + OTP | Full Legal Name, Mobile Number, District, Municipality / Mandal | Grievance Category (Roads & Buildings / R&B), Land/Street Location, Photo Evidence | **Structure Documented** (Automated filing prohibited by state security policy; supported via Citizen-Assisted Dossier) |
| `MOCK_PORTAL` | RoadGuard Local Testing Portal | Internal E2E Automation Harness (`http://localhost:8089`) | Mobile Auth (`9876543210`) + Test OTP (`582914`) + Math CAPTCHA | Full Legal Name, 10-Digit Mobile Number | Defect Type, GPS Lat/Lng, Photo Evidence | **Fully Verified & Automated E2E** |

---

## 3. Detailed Portal Analyses

### 3.1 RajmargYatra (NHAI)

- **Official Source**: National Highways Authority of India (NHAI) & Ministry of Road Transport and Highways (MoRTH) public grievance guidelines.
- **Verified Requirements**:
  - **Citizen Profile**: Full legal name and verified 10-digit Indian mobile number.
  - **Authentication**: Mobile number input triggers a temporary 6-digit SMS OTP. RoadGuard does not automate OTP interception; the local automation worker prompts the citizen via Human-in-the-Loop (HITL) WebSocket or modal dialog.
  - **Jurisdiction & Routing**: Highway defect routing is based on **inspection GPS coordinates** and National Highway (NH) corridor identification, NOT residential address.
  - **Evidence**: At least one geolocated photo of road surface damage is required.
- **Unverified / Limitations**:
  - Vehicle Registration Number (VRN) is optional; it helps fast-track vehicle damage claims resulting from potholes but is not mandatory for general road defect reporting.
  - Live filing API is not publicly exposed to third parties; citizen-assisted Playwright automation handles the workflow.

### 3.2 Andhra Pradesh CDMA / Puramithra

- **Official Source**: Commissioner & Director of Municipal Administration, Government of Andhra Pradesh (`cdma.ap.gov.in`).
- **Verified Requirements**:
  - **Citizen Profile**: Full name, 10-digit mobile number, and targeted **Municipality / Urban Local Body (ULB)** (e.g., Vijayawada Municipal Corporation, Guntur MC, Tirupati MC).
  - **Authentication**: Mobile OTP verification.
  - **Jurisdiction & Routing**: Civic grievances are routed to the specific Municipal Commissioner and Ward Secretariat (Grama/Ward Sachivalayam). Selecting the correct ULB from the profile or inspection location is mandatory.
  - **Evidence**: On-site photo evidence and localized defect description.
- **Unverified / Limitations**:
  - Rural Panchayat roads fall under PR&RD (Panchayati Raj and Rural Development) rather than CDMA. If an inspection occurs outside municipal limits, CDMA will reject the grievance. RoadGuard flags this in jurisdiction checks.

### 3.3 Andhra Pradesh Mee Kosam / PGRS

- **Official Source**: Government of Andhra Pradesh Portal for Public Grievance Redressal (`meekosam.ap.gov.in`).
- **Verified Requirements**:
  - **Authentication**: Implements stringent BotDetect visual CAPTCHA and Aadhaar-linked OTP verification. Automated head-less bot login is strictly prevented by state security policy.
  - **Citizen Action**: Human interaction is mandatory. RoadGuard implements a **Citizen-Assisted Preparation Flow**: RoadGuard compiles the exact defect dossier, coordinates, road photos, and department categorization (Roads & Buildings / R&B), pre-fills the complaint text, and directs the citizen to complete the official submission.
- **Unverified / Limitations**:
  - Third-party API integration without Aadhaar eKYC licensing is unverified and legally restricted. RoadGuard strictly respects state security standards.

---

## 4. Portal Requirements & Readiness Engine

RoadGuard backend implements `PortalRequirementsEngine` (`com.roadguard.api.service.PortalRequirementsEngine`), which evaluates a citizen's profile against each portal's prerequisites:

### 4.1 Evaluation Criteria

1. **Personal Information Score**:
   - Legal Name present: 35 points
   - 10-Digit Mobile Number present: 35 points
   - Email Address present: 20 points
   - Preferred Language specified: 10 points
   - **Total Personal**: 100 points

2. **Address & Civic Jurisdiction Score**:
   - State present: 20 points
   - District present: 25 points
   - City / Municipality / ULB present: 30 points
   - Ward Number present: 15 points
   - PIN Code present: 10 points
   - **Total Address**: 100 points

3. **Portal-Specific Readiness**:
   - `READY`: All required profile fields and jurisdiction attributes satisfied; automation adapter tested and available.
   - `PARTIALLY_READY`: Core identity present, but missing portal-specific jurisdiction (e.g. ULB for CDMA) or requires manual citizen handoff (e.g. Mee Kosam).
   - `INCOMPLETE`: Critical identity fields (e.g. Mobile number, Full Name) missing.

---

## 5. Security & Privacy Safeguards

1. **Zero-Knowledge Credential Policy**:
   - RoadGuard NEVER requests, stores, or logs citizen government portal passwords.
   - RoadGuard NEVER stores SMS OTPs, Aadhaar numbers, or CAPTCHA answers in database tables or server log files.
2. **Data Minimization**:
   - Only fields required for civic grievance filing (Name, Mobile, Jurisdiction) are retained.
   - Sensitive financial, identity card, or biometric attributes are deliberately omitted.
3. **Per-User Isolation**:
   - All profile retrieval and mutation endpoints require authenticated session context (`UserProfileService` enforces user isolation).
4. **Transient Evidence Handling**:
   - Damage inspection photos and GPS breadcrumbs remain in dedicated complaint evidence storage and are never merged into citizen identity records.
