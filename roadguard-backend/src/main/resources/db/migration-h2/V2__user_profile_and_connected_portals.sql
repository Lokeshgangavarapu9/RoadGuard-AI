-- ============================================================
-- RoadGuard AI — V2 User Profile & Connected Government Portals
-- ============================================================

-- ── USER PROFILES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
    id                      BIGINT          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name               VARCHAR(150)    NOT NULL,
    email                   VARCHAR(200)    NOT NULL,
    phone                   VARCHAR(25)     NOT NULL,
    address                 VARCHAR(500),
    primary_vrn             VARCHAR(50),
    primary_vrn_normalized  VARCHAR(50),
    vehicle_type            VARCHAR(20)     DEFAULT 'CAR',
    additional_vehicles     VARCHAR(1000),
    created_at              TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed single default citizen profile for local development
INSERT INTO user_profiles (full_name, email, phone, address, primary_vrn, primary_vrn_normalized, vehicle_type, additional_vehicles)
VALUES (
    'Lokesh Kumar',
    'lokesh.citizen@roadguard.local',
    '+91 98765 43210',
    'Door 4-12, Ring Road, Benz Circle, Vijayawada, Andhra Pradesh - 520010',
    'AP 16 AB 1234',
    'AP16AB1234',
    'CAR',
    'AP 16 XY 9876 (Two-Wheeler)'
);

-- ── CONNECTED GOVERNMENT PORTALS ──────────────────────────────
CREATE TABLE IF NOT EXISTS connected_portals (
    id                      BIGINT          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    portal_id               VARCHAR(50)     NOT NULL UNIQUE,
    portal_name             VARCHAR(150)    NOT NULL,
    official_url            VARCHAR(300)    NOT NULL,
    road_jurisdiction       VARCHAR(200)    NOT NULL,
    status                  VARCHAR(50)     NOT NULL DEFAULT 'MANUAL_HANDOFF_ONLY',
    last_verified_at        TIMESTAMP,
    connection_notes        VARCHAR(1000)
);

-- Seed initial portal records with transparent, truthful statuses
INSERT INTO connected_portals (portal_id, portal_name, official_url, road_jurisdiction, status, last_verified_at, connection_notes)
VALUES 
(
    'RAJMARGYATRA_NHAI',
    'Rajmargyatra / NHAI',
    'https://rajmargyatra.nhai.gov.in/',
    'National Highways (NH corridors across India)',
    'MANUAL_HANDOFF_ONLY',
    CURRENT_TIMESTAMP,
    'Official direct submission API is restricted to NHAI intranet networks. RoadGuard AI compiles verified coordinates, highway chainage, and evidence photos into an official dossier for user-controlled handoff.'
),
(
    'AP_CDMA',
    'Andhra Pradesh CDMA Grievance Redressal',
    'https://cdma.ap.gov.in/services/grievances/',
    'Municipal & Urban Local Body Roads (123+ AP Cities)',
    'MANUAL_HANDOFF_ONLY',
    CURRENT_TIMESTAMP,
    'CDMA requires Citizen Mobile OTP through the Puramithra/CDMA citizen portal. RoadGuard AI prepares the municipal category (Roads -> Potholes), ward details, and photo package for citizen filing.'
),
(
    'AP_MEEKOSAM_PGRS',
    'Andhra Pradesh Mee Kosam / PGRS',
    'https://meekosam.ap.gov.in/',
    'State Highways, Major District Roads & Rural PMGSY',
    'MANUAL_HANDOFF_ONLY',
    CURRENT_TIMESTAMP,
    'Portal is secured by BotDetect CAPTCHA and Aadhaar/Mobile OTP. Programmatic bot submissions are strictly prohibited by state security policy. RoadGuard AI generates a formal legal complaint draft with Section 133 CrPC and IRC:82-2015 grounds.'
);
