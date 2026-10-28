-- =========================================================================
-- RoadGuard AI — V3 H2 Compatibility Migration
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

-- 4. Clean up seeded mock complaints and fake reference numbers
DELETE FROM complaints WHERE simulated_ref_id LIKE 'SIM-%' OR status = 'SIMULATED';

-- 5. Truthful Portal Status Updates
UPDATE connected_portals 
SET status = 'MANUAL_HANDOFF_ONLY',
    connection_notes = 'Citizen authentication required via official portal. Automated background bot filing is prohibited by portal terms.'
WHERE status = 'CONNECTED';

