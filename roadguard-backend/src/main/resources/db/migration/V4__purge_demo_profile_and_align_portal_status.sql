-- =========================================================================
-- RoadGuard AI — V4 Purge Legacy Demo Profile & Align Portal Status
-- =========================================================================

-- 1. Purge legacy mock demo citizen profile so all new or unknown users
-- receive a clean, empty profile form rather than fabricated personal details.
DELETE FROM user_profiles 
WHERE email = 'lokesh.citizen@roadguard.local' 
   OR (full_name = 'Lokesh Kumar' AND primary_vrn_normalized = 'AP16AB1234')
   OR phone = '+91 98765 43210';

-- 2. Truthfully update official portal URLs, statuses, and notes
-- Align URLs to the precise citizen grievance & status tracking pages.

-- Rajmargyatra / NHAI: complaints and status tracking page
UPDATE connected_portals
SET official_url = 'https://rajmargyatra.nhai.gov.in/complaints',
    status = 'MANUAL_HANDOFF_ONLY',
    last_verified_at = CURRENT_TIMESTAMP,
    connection_notes = 'Citizen Mobile OTP login required. Check complaint status directly under "View complaint status" on Rajmargyatra.'
WHERE portal_id = 'RAJMARGYATRA_NHAI';

-- Andhra Pradesh CDMA Grievance Redressal: citizen services grievance page
UPDATE connected_portals
SET official_url = 'https://cdma.ap.gov.in/services/grievances/',
    status = 'MANUAL_HANDOFF_ONLY',
    last_verified_at = CURRENT_TIMESTAMP,
    connection_notes = 'Citizen Puramithra/CDMA Mobile OTP login required. Check grievance status directly under "Services -> Grievances" on the CDMA portal.'
WHERE portal_id = 'AP_CDMA';

-- Andhra Pradesh Mee Kosam / PGRS: state grievance portal
UPDATE connected_portals
SET official_url = 'https://meekosam.ap.gov.in/',
    status = 'MANUAL_HANDOFF_ONLY',
    last_verified_at = CURRENT_TIMESTAMP,
    connection_notes = 'Portal secured by BotDetect CAPTCHA & Aadhaar OTP. Check complaint status directly on Andhra Pradesh Mee Kosam / PGRS.'
WHERE portal_id = 'AP_MEEKOSAM_PGRS';
