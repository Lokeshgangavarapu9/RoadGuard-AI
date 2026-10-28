# Official Government Complaint Portals Research & Integration Architecture

**Document Version**: 1.0.0  
**Date**: October 24, 2026  
**Auditor**: Senior Integration Researcher & Full-Stack GIS Engineer  
**Project**: RoadGuard AI (`C:\Users\LOKESH\java project 2026`)

---

## 1. Executive Summary & Core Rules

This document establishes the verified technical specifications, jurisdictional boundaries, identity requirements, evidence standards, and permitted integration methodologies for official road-defect complaint destinations in India, specifically focusing on National Highways and Andhra Pradesh state/urban road networks.

### Non-Negotiable Integration Rules

1. **No Fake APIs**: Never invent REST endpoints, OAuth flows, or automated submission protocols that are not publicly published and officially supported by the government authority.
2. **No Bypassing Security**: Do not bypass CAPTCHA (BotDetect, reCAPTCHA), SMS OTPs, CSRF tokens, or WAF rate limits.
3. **Transparent Truthful States**: A portal is marked `CONNECTED_VERIFIED` only if an active, authorized authenticated session/token has been verified. Otherwise, states such as `MANUAL_HANDOFF_ONLY`, `API_UNAVAILABLE`, `LOGIN_REQUIRED`, or `NOT_CONNECTED` must be explicitly declared.
4. **Deterministic Authority Routing**:
   - **National Highway (NH-prefix)** &rarr; NHAI / Rajmargyatra or MoRTH.
   - **Municipal / ULB Roads (Vijayawada, Visakhapatnam, Guntur)** &rarr; AP CDMA / Puramithra.
   - **State Highways (SH) / Rural PMGSY / District Roads** &rarr; AP Mee Kosam / PGRS or AP R&B.
   - **Unknown / Ambiguous Ownership** &rarr; Flagged as `Authority not verified` requiring citizen confirmation.
5. **Simulated Disclaimers**: All auto-drafted complaints must display visible simulation watermarks during testing and require explicit user review and confirmation before manual handoff.

---

## 2. Portal A: Rajmargyatra / National Highways Authority of India (NHAI)

| Parameter | Verified Specification |
|---|---|
| **Official Name** | Rajmargyatra (NHAI MoRTH Highway Citizen Portal & Mobile App) |
| **Official URLs** | Web: [https://rajmargyatra.nhai.gov.in/](https://rajmargyatra.nhai.gov.in/) • MoRTH: [https://nhai.gov.in/](https://nhai.gov.in/) |
| **Geographic Scope** | All National Highways (NH corridors) across India, including NH-16 (Chennai-Kolkata), NH-65 (Pune-Machilipatnam). |
| **Road Jurisdiction** | Exclusively **National Highways** and NHAI toll plazas / concessions. **Excludes** State Highways, Municipal roads, and Rural roads. |
| **Supported Categories** | 1. Road Maintenance (Potholes, Pavement Cracks, Surface Deterioration)<br/>2. Road Hazards & Obstructions<br/>3. Signage & Safety Deficiencies<br/>4. Toll Plaza Disputes / Fastag Issues<br/>5. Accident & Emergency Assistance |
| **Identity Verification** | Mobile phone number verified via **SMS OTP**. User profile binds phone number and name. |
| **Vehicle Registration Number (VRN)** | **Optional for general road hazards/potholes**; mandatory for toll plaza / FASTag grievances. Recommended for incident provenance. |
| **Applicant Fields** | Name, Mobile Number (verified), Email address, State/District. |
| **Required Complaint Fields** | Highway Number (e.g. NH-16), Chainage / KM Marker or GPS Coordinates, Direction of Travel (LHS/RHS), Detailed Description. |
| **Supported Evidence** | Geo-tagged photographs (JPEG/PNG) and short video clips (MP4). Maximum file size ~10 MB. |
| **GPS / Geotagging** | Required: Native mobile app extracts EXIF/hardware GPS coordinates to pinpoint exact highway chainage. |
| **Submission Method** | Citizen submission via authenticated mobile application (Android/iOS) or authenticated citizen web portal. |
| **Tracking / Receipt** | Generates official grievance ticket ID (e.g., `NHAI-GRV-YYYY-XXXXX`) with automated SMS updates and multi-level concessionaire escalation. |
| **Public API Status** | **API_UNAVAILABLE (No Third-Party Submission API)**. NHAI restricts direct programmatic endpoints behind internal government firewalls. Integration must be user-controlled assisted handoff. |
| **Integration Decision** | **MANUAL_HANDOFF_ONLY / ASSISTED PACKET**: RoadGuard AI compiles verified coordinates, highway matching, defect class, and evidence photos into an official pre-addressed dossier and links to Rajmargyatra citizen portal for user-confirmed submission. |

---

## 3. Portal B: Andhra Pradesh CDMA (Commissioner & Director of Municipal Administration)

| Parameter | Verified Specification |
|---|---|
| **Official Name** | CDMA Grievance Redressal / Puramithra Citizen Portal |
| **Official URLs** | Portal: [https://cdma.ap.gov.in/services/grievances/](https://cdma.ap.gov.in/services/grievances/) • Citizen Auth: `https://cdma.ap.gov.in/auth/login` |
| **Geographic Scope** | Andhra Pradesh Urban Local Bodies (ULBs) — 123+ Municipalities & Municipal Corporations (e.g., VMC Vijayawada, GVMC Visakhapatnam, GMC Guntur). |
| **Road Jurisdiction** | **Municipal Roads, City Streets, Colony Avenues, Internal Ward Layouts**. Excludes NHAI National Highways and R&B State Highways. |
| **Supported Categories** | 1. **Roads**: Sub-issues: **Potholes**, **Road Damage**, **Speed Breakers Required**<br/>2. Sanitation & Waste Management<br/>3. Water Supply & Pipeline Leakage<br/>4. Street Lighting & Electrical Hazards<br/>5. Parks & Urban Greenery |
| **Identity Verification** | Citizen Login via Mobile Number with OTP verification, or Puramithra mobile app credentials. |
| **Vehicle Registration Number (VRN)** | Not required for municipal potholes. |
| **Applicant Fields** | Citizen Name, Mobile Number, ULB / Corporation Name, Ward Number, Locality / Street Address. |
| **Required Complaint Fields** | Category (`Roads`), Subcategory (`Potholes` or `Road Damage`), Ward/Locality, Landmark Description, Grievance Text. |
| **Supported Evidence** | Photographs (JPEG/PNG up to 5 MB). Documented support for ward geo-location. |
| **Submission Method** | Citizen self-service portal or Puramithra Android/iOS application. |
| **Tracking / Receipt** | Generates municipal grievance reference number (e.g., `ULB-GRV-XXXXXX`) tracked via CDMA / Puramithra dashboard. |
| **Public API Status** | **API_UNAVAILABLE (No Public Open API)**. CDMA APIs are reserved for internal e-Office and CMMS (Computerized Municipal Management System) integrations. |
| **Integration Decision** | **MANUAL_HANDOFF_ONLY / ASSISTED DRAFT**: RoadGuard AI outputs exact ULB jurisdiction, road category (`Roads -> Potholes`), geo-coordinates, and photos for direct user submission on the CDMA portal. |

---

## 4. Portal C: Andhra Pradesh Mee Kosam / Public Grievance Redressal System (PGRS)

| Parameter | Verified Specification |
|---|---|
| **Official Name** | Public Grievance Redressal System (PGRS) / Chief Minister's Grievance Redressal System (CMGRS) |
| **Official URLs** | Portal: [https://meekosam.ap.gov.in/](https://meekosam.ap.gov.in/) • Status: `https://meekosam.ap.gov.in/ApplicationStatus.aspx` |
| **Managing Agency** | Real Time Governance Society (RTGS), Block 1, Secretariat, Velagapudi, Amaravathi, AP. |
| **Geographic Scope** | Entire state of Andhra Pradesh (26 districts, all mandals and revenue divisions). |
| **Road Jurisdiction** | **State Highways (SH), Major District Roads (MDR), Other District Roads (ODR), and PMGSY Rural Roads** managed by AP Roads & Buildings (R&B) or Panchayat Raj Engineering Department (PRED). Also acts as universal escalation channel. |
| **Supported Categories** | Roads and Buildings (R&B), Panchayat Raj Road Maintenance, Bridge Repairs, Traffic Infrastructure, Public Nuisance. |
| **Identity Verification** | Citizen Login secured with **BotDetect CAPTCHA Form Validation** and **Aadhaar Number / Mobile OTP**. |
| **Vehicle Registration Number (VRN)** | Not mandatory; citizen identity (Aadhaar/Phone) is primary identifier. |
| **Applicant Fields** | Name, Aadhaar ID, Mobile Phone, District, Mandal, Village/Ward, Postal Address. |
| **Required Complaint Fields** | Department (`Roads & Buildings` or `Panchayat Raj`), Grievance Subject, Location Description, Grievance Details. |
| **Supported Evidence** | PDF/JPEG supporting evidence documents (Max 5 MB). |
| **Submission Method** | Online via Mee Kosam citizen portal, MeeSeva kiosks, or weekly Monday "Spandana / PGRS" district grievance meetings. |
| **Tracking / Receipt** | Generates official state grievance tracking number (e.g., `PGRS-AP-YYYY-XXXXX`) verifiable at `/ApplicationStatus.aspx`. |
| **Public API Status** | **API_UNAVAILABLE (Strict BotDetect CAPTCHA & Aadhaar OTP protected)**. Direct bot submission without human presence is prohibited and blocked by design. |
| **Integration Decision** | **MANUAL_HANDOFF_ONLY / STATUTORY CITIZEN DOSSIER**: RoadGuard AI compiles an audit packet formatted with Section 133 CrPC and IRC:82-2015 grounds, location coordinates, and evidence attachments for citizen submission. |

---

## 5. Architectural Comparison & Routing Decision Matrix

```text
                                 Road Defect Detected
                                          │
                                          ▼
                         Road Authority & Hierarchy Check
                                          │
         ┌────────────────────────────────┼──────────────────────────────┐
         ▼                                ▼                              ▼
   National Highway                 Municipal Street               State / Rural / MDR
  (e.g., NH-16, NH-65)         (Vijayawada, Guntur, Vizag)         (SH-corridors, PMGSY)
         │                                │                              │
         ▼                                ▼                              ▼
  Destination:                     Destination:                   Destination:
  NHAI / Rajmargyatra              AP CDMA / Puramithra           AP Mee Kosam (PGRS)
         │                                │                              │
         ▼                                ▼                              ▼
  Handoff Mode:                    Handoff Mode:                  Handoff Mode:
  MANUAL_HANDOFF_ONLY              MANUAL_HANDOFF_ONLY            MANUAL_HANDOFF_ONLY
  (Assisted Dossier)               (Puramithra Assisted)          (CMGRS Legal Packet)
```

### Destination Selection Logic

1. **If road contains `NH-` or matches NHAI highway database**:
   - Authority: `NHAI`
   - Portal: **Rajmargyatra**
   - Action: Pre-fills highway number, chainage coordinates, pothole photos, and opens `https://rajmargyatra.nhai.gov.in/`.
2. **If location falls inside an Andhra Pradesh Urban Local Body**:
   - Authority: `CDMA_ULB` (e.g. Vijayawada Municipal Corporation)
   - Portal: **AP CDMA Grievance Redressal**
   - Action: Pre-fills `Roads -> Potholes`, ward details, and opens `https://cdma.ap.gov.in/services/grievances/`.
3. **If road is a State Highway or Rural Corridor**:
   - Authority: `AP_RNB` or `AP_PRED_PMGSY`
   - Portal: **AP Mee Kosam (PGRS)**
   - Action: Pre-fills R&B department, village/mandal, and opens `https://meekosam.ap.gov.in/`.
4. **If road ownership is indeterminate**:
   - Authority: `UNKNOWN` ("Authority not verified")
   - Action: Displays `Authority not verified` and prompts citizen to select the appropriate jurisdiction.
