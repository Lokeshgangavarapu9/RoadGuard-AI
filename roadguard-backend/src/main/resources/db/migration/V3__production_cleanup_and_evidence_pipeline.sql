-- =========================================================================
-- RoadGuard AI — V3 Production Cleanup & Real Evidence Pipeline Migration
-- =========================================================================

-- 1. Add Image Quality & Telemetry Audit Columns to evidence_frames
ALTER TABLE evidence_frames ADD COLUMN IF NOT EXISTS sharpness_score DOUBLE PRECISION;
ALTER TABLE evidence_frames ADD COLUMN IF NOT EXISTS brightness_score DOUBLE PRECISION;
ALTER TABLE evidence_frames ADD COLUMN IF NOT EXISTS quality_status VARCHAR(30) DEFAULT 'CLEAR';
ALTER TABLE evidence_frames ADD COLUMN IF NOT EXISTS gps_accuracy_m DOUBLE PRECISION;
ALTER TABLE evidence_frames ADD COLUMN IF NOT EXISTS heading_deg DOUBLE PRECISION;
ALTER TABLE evidence_frames ADD COLUMN IF NOT EXISTS speed_mps DOUBLE PRECISION;
ALTER TABLE evidence_frames ADD COLUMN IF NOT EXISTS image_width INT;
ALTER TABLE evidence_frames ADD COLUMN IF NOT EXISTS image_height INT;

-- 2. Add Multi-Factor Grouping Audit Table
CREATE TABLE IF NOT EXISTS event_grouping_audit (
    id                      BIGINT          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    group_uuid              VARCHAR(36)     NOT NULL,
    road_issue_id           BIGINT          NOT NULL REFERENCES road_issues(id) ON DELETE CASCADE,
    frame_id                BIGINT          REFERENCES evidence_frames(id) ON DELETE SET NULL,
    spatial_distance_m      DOUBLE PRECISION,
    heading_delta_deg       DOUBLE PRECISION,
    temporal_delta_seconds  DOUBLE PRECISION,
    best_evidence_score     DOUBLE PRECISION,
    created_at              TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_grouping_issue ON event_grouping_audit(road_issue_id);
CREATE INDEX IF NOT EXISTS idx_grouping_uuid ON event_grouping_audit(group_uuid);

-- 3. Upgrade Complaints Table for 9-State Lifecycle & Idempotency
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100);
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS routing_evidence VARCHAR(2000);
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS official_portal_url VARCHAR(500);
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS submission_notes VARCHAR(1000);

-- Update status constraint on complaints to support all 9 production states
ALTER TABLE complaints DROP CONSTRAINT IF EXISTS complaints_status_chk;
ALTER TABLE complaints ADD CONSTRAINT complaints_status_chk CHECK (status IN (
    'DRAFT',
    'AWAITING_REVIEW',
    'VERIFIED',
    'COMPLAINT_PREPARED',
    'AWAITING_USER_ACTION',
    'SUBMISSION_IN_PROGRESS',
    'SUBMITTED',
    'SUBMISSION_FAILED',
    'SUBMISSION_UNKNOWN',
    'APPROVED',
    'SIMULATED',
    'WITHDRAWN',
    'FAILED'
));

CREATE UNIQUE INDEX IF NOT EXISTS idx_complaint_idempotency 
    ON complaints(idempotency_key);

-- Composite index accelerating active complaint lookup for a road issue
CREATE INDEX IF NOT EXISTS idx_active_complaint_per_issue
    ON complaints(road_issue_id, status);

-- 4. Clean up seeded mock complaints and fake reference numbers
DELETE FROM complaints WHERE simulated_ref_id LIKE 'SIM-%' OR simulated_ref_id LIKE 'STM-AP-%' OR status = 'SIMULATED';

-- Clean up seeded demo citizen PII
DELETE FROM user_profiles WHERE email = 'lokesh.citizen@roadguard.local' OR full_name = 'Lokesh Kumar';

-- 5. Truthful Portal Status Updates
UPDATE connected_portals 
SET status = 'LOGIN_REQUIRED',
    official_url = 'https://rajmargyatra.nhai.gov.in/complaint-login-page',
    connection_notes = 'Citizen Mobile SMS OTP authentication required on official portal.'
WHERE portal_id = 'RAJMARGYATRA_NHAI';

UPDATE connected_portals 
SET status = 'LOGIN_REQUIRED',
    official_url = 'https://cdma.ap.gov.in/services/grievances/',
    connection_notes = 'Citizen Puramithra credentials required on official portal.'
WHERE portal_id = 'AP_CDMA';

UPDATE connected_portals 
SET status = 'LOGIN_REQUIRED',
    official_url = 'https://meekosam.ap.gov.in/',
    connection_notes = 'State grievance portal citizen registration required.'
WHERE portal_id = 'AP_MEEKOSAM_PGRS';
