-- =========================================================================
-- RoadGuard AI — V3 Production Cleanup & Real Evidence Pipeline Migration
-- =========================================================================

-- 1. Add Image Quality & Telemetry Audit Columns to evidence_frames
ALTER TABLE evidence_frames 
    ADD COLUMN IF NOT EXISTS sharpness_score DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS brightness_score DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS quality_status VARCHAR(30) DEFAULT 'CLEAR',
    ADD COLUMN IF NOT EXISTS gps_accuracy_m DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS heading_deg DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS speed_mps DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS image_width INT,
    ADD COLUMN IF NOT EXISTS image_height INT;

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
ALTER TABLE complaints
    ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100),
    ADD COLUMN IF NOT EXISTS routing_evidence VARCHAR(2000),
    ADD COLUMN IF NOT EXISTS official_portal_url VARCHAR(500),
    ADD COLUMN IF NOT EXISTS submission_notes VARCHAR(1000);

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
    ON complaints(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Partial unique index preventing duplicate active complaints for the same road issue
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_complaint_per_issue
    ON complaints(road_issue_id) 
    WHERE status IN ('DRAFT', 'AWAITING_REVIEW', 'VERIFIED', 'COMPLAINT_PREPARED', 'AWAITING_USER_ACTION', 'SUBMISSION_IN_PROGRESS', 'SUBMITTED');

-- 4. Clean up seeded mock complaints and fake reference numbers
DELETE FROM complaints WHERE simulated_ref_id LIKE 'SIM-%' OR simulated_ref_id LIKE 'STM-AP-%' OR status = 'SIMULATED';

-- Clean up seeded demo citizen PII
DELETE FROM user_profiles WHERE email = 'lokesh.citizen@roadguard.local' OR full_name = 'Lokesh Kumar';

-- 5. Truthful Portal Status Updates
UPDATE connected_portals 
SET status = 'LOGIN_REQUIRED',
    portal_url = 'https://rajmargyatra.nhai.gov.in/complaint-login-page',
    connection_notes = 'Citizen Mobile SMS OTP authentication required on official portal.'
WHERE dept_code = 'NHAI_AP';

UPDATE connected_portals 
SET status = 'LOGIN_REQUIRED',
    portal_url = 'https://cdma.ap.gov.in/services/grievances/',
    connection_notes = 'Citizen Puramithra credentials required on official portal.'
WHERE dept_code = 'AP_CDMA';

UPDATE connected_portals 
SET status = 'LOGIN_REQUIRED',
    portal_url = 'https://services.india.gov.in',
    connection_notes = 'State grievance portal citizen registration required.'
WHERE dept_code = 'AP_RBD';
