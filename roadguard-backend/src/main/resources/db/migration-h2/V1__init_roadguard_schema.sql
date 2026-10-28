-- ============================================================
-- RoadGuard AI — V1 Initial Schema (H2 compatible)
-- Stage A: H2 in-memory mode (no PostGIS)
-- Stage B: Migrate to PostgreSQL + PostGIS
--          (replace DOUBLE PRECISION lat/lon with GEOGRAPHY type)
-- ============================================================

-- ── JOURNEYS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journeys (
    id                  BIGINT          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid                VARCHAR(36)     NOT NULL UNIQUE,
    status              VARCHAR(20)     NOT NULL DEFAULT 'CREATED',
        -- CREATED | ACTIVE | STOPPED | CANCELLED
    vehicle_type        VARCHAR(20),
        -- CAR | BIKE | AUTO | TRUCK
    rider_name          VARCHAR(100),
    rider_email         VARCHAR(200),
    -- Location at journey start
    start_latitude      DOUBLE PRECISION,
    start_longitude     DOUBLE PRECISION,
    start_address       VARCHAR(500),
    end_latitude        DOUBLE PRECISION,
    end_longitude       DOUBLE PRECISION,
    end_address         VARCHAR(500),
    distance_meters     DOUBLE PRECISION DEFAULT 0.0,
    -- Timing
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at          TIMESTAMP,
    stopped_at          TIMESTAMP,
    -- Frame statistics
    total_frames        INT             NOT NULL DEFAULT 0,
    processed_frames    INT             NOT NULL DEFAULT 0,
    -- Demo / real mode flag
    demo_mode           BOOLEAN         NOT NULL DEFAULT FALSE,
    demo_source         VARCHAR(200),   -- GPX or video file name if demo
    notes               VARCHAR(1000),
    CONSTRAINT journeys_status_chk CHECK (status IN ('CREATED','ACTIVE','STOPPED','CANCELLED'))
);
CREATE INDEX idx_journeys_uuid ON journeys(uuid);
CREATE INDEX idx_journeys_status ON journeys(status);
CREATE INDEX idx_journeys_created_at ON journeys(created_at);

-- ── GPS TELEMETRY ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gps_locations (
    id              BIGINT          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    journey_id      BIGINT          NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
    latitude        DOUBLE PRECISION NOT NULL,
    longitude       DOUBLE PRECISION NOT NULL,
    altitude        DOUBLE PRECISION,
    accuracy        DOUBLE PRECISION,   -- metres, from browser
    speed           DOUBLE PRECISION,   -- m/s, NULL if unavailable
    heading         DOUBLE PRECISION,   -- degrees 0-360, NULL if unavailable
    recorded_at     TIMESTAMP       NOT NULL,   -- browser timestamp
    received_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sequence_num    INT             NOT NULL DEFAULT 0
);
CREATE INDEX idx_gps_journey ON gps_locations(journey_id);
CREATE INDEX idx_gps_recorded_at ON gps_locations(journey_id, recorded_at);

-- ── EVIDENCE FRAMES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evidence_frames (
    id                  BIGINT          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid                VARCHAR(36)     NOT NULL UNIQUE,
    journey_id          BIGINT          NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
    -- File storage
    storage_key         VARCHAR(500)    NOT NULL,   -- relative path or MinIO object key
    storage_type        VARCHAR(20)     NOT NULL DEFAULT 'LOCAL',
        -- LOCAL | MINIO | S3
    original_filename   VARCHAR(255),
    content_type        VARCHAR(100),
    file_size_bytes     BIGINT,
    -- Integrity
    sha256_digest       VARCHAR(64),    -- hex SHA-256 of original file
    pii_processed       BOOLEAN         NOT NULL DEFAULT FALSE,  -- face/plate blur applied
    -- Capture context
    latitude            DOUBLE PRECISION,
    longitude           DOUBLE PRECISION,
    captured_at         TIMESTAMP,
    received_at         TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Source type
    source_type         VARCHAR(30)     NOT NULL DEFAULT 'LIVE_CAMERA',
        -- LIVE_CAMERA | PRERECORDED | UPLOADED_STATIC
    frame_sequence      INT,
    -- Inference state
    inference_status    VARCHAR(30)     NOT NULL DEFAULT 'PENDING',
        -- PENDING | PROCESSING | DONE | SKIPPED | FAILED
    CONSTRAINT frames_storage_type_chk CHECK (storage_type IN ('LOCAL','MINIO','S3')),
    CONSTRAINT frames_source_type_chk  CHECK (source_type IN ('LIVE_CAMERA','PRERECORDED','UPLOADED_STATIC'))
);
CREATE INDEX idx_frames_journey ON evidence_frames(journey_id);
CREATE INDEX idx_frames_uuid ON evidence_frames(uuid);

-- ── ROAD ISSUES (confirmed defects) ─────────────────────────
CREATE TABLE IF NOT EXISTS road_issues (
    id                      BIGINT          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid                    VARCHAR(36)     NOT NULL UNIQUE,
    journey_id              BIGINT          NOT NULL REFERENCES journeys(id),
    -- Classification
    defect_class            VARCHAR(50)     NOT NULL,
        -- POTHOLE | ROAD_CRACK | ALLIGATOR_CRACK | TRANSVERSE_CRACK | WATERLOGGING | UNKNOWN
    severity                VARCHAR(20)     NOT NULL DEFAULT 'UNKNOWN',
        -- LOW | MEDIUM | HIGH | CRITICAL | UNKNOWN
    -- Location (GPS reported — no homography correction in Stage A)
    latitude                DOUBLE PRECISION NOT NULL,
    longitude               DOUBLE PRECISION NOT NULL,
    location_accuracy_m     DOUBLE PRECISION,
    address                 VARCHAR(500),
    road_name               VARCHAR(300),
    -- Detection provenance
    detection_mode          VARCHAR(30)     NOT NULL DEFAULT 'MOCK',
        -- REAL_ONNX | REAL_HTTP | MOCK | DEMO_REPLAY | MANUAL
    confidence_score        DOUBLE PRECISION,
    observation_count       INT             NOT NULL DEFAULT 1,
    first_seen_at           TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at            TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Lifecycle
    status                  VARCHAR(30)     NOT NULL DEFAULT 'DETECTED',
        -- DETECTED | INVESTIGATING | COMPLAINT_DRAFTED | COMPLAINT_SUBMITTED | RESOLVED | DUPLICATE | INVALID
    duplicate_of_id         BIGINT          REFERENCES road_issues(id),
    -- Geospatial (Stage A: stored as plain doubles; Stage B: PostGIS GEOGRAPHY)
    -- When migrating to PostGIS, add: location GEOGRAPHY(POINT, 4326)
    notes                   VARCHAR(1000),
    created_at              TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT issues_defect_class_chk CHECK (defect_class IN (
        'POTHOLE','ROAD_CRACK','ALLIGATOR_CRACK','TRANSVERSE_CRACK','WATERLOGGING','UNKNOWN')),
    CONSTRAINT issues_detection_mode_chk CHECK (detection_mode IN (
        'REAL_ONNX','REAL_HTTP','MOCK','DEMO_REPLAY','MANUAL'))
);
CREATE INDEX idx_issues_uuid ON road_issues(uuid);
CREATE INDEX idx_issues_journey ON road_issues(journey_id);
CREATE INDEX idx_issues_status ON road_issues(status);
CREATE INDEX idx_issues_defect_class ON road_issues(defect_class);
-- Stage B: CREATE INDEX idx_issues_location ON road_issues USING GIST(location);

-- ── DETECTION OBSERVATIONS (raw per-frame results) ────────────
CREATE TABLE IF NOT EXISTS detection_observations (
    id                  BIGINT          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    frame_id            BIGINT          NOT NULL REFERENCES evidence_frames(id) ON DELETE CASCADE,
    road_issue_id       BIGINT          REFERENCES road_issues(id),
    -- Raw model output
    raw_class_label     VARCHAR(50)     NOT NULL,
    raw_confidence      DOUBLE PRECISION NOT NULL,
    -- Bounding box (normalised 0..1, relative to frame)
    bbox_x1             DOUBLE PRECISION,
    bbox_y1             DOUBLE PRECISION,
    bbox_x2             DOUBLE PRECISION,
    bbox_y2             DOUBLE PRECISION,
    -- Temporal confirmation state
    confirmed           BOOLEAN         NOT NULL DEFAULT FALSE,
    confirmation_frame  INT,            -- which frame in the window triggered confirmation
    -- Mode
    inference_mode      VARCHAR(30)     NOT NULL DEFAULT 'MOCK',
    detected_at         TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_detobs_frame ON detection_observations(frame_id);
CREATE INDEX idx_detobs_issue ON detection_observations(road_issue_id);

-- ── AUTHORITY RECORDS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS authority_records (
    id              BIGINT          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dept_code       VARCHAR(50)     NOT NULL UNIQUE,
        -- NHAI | AP_RNB | CDMA_ULB | AP_PRED_PMGSY | UNKNOWN
    dept_name       VARCHAR(200)    NOT NULL,
    jurisdiction    VARCHAR(100),   -- road type governed
    portal_url      VARCHAR(500),
    grievance_url   VARCHAR(500),
    helpline        VARCHAR(100),
    state           VARCHAR(100)    DEFAULT 'Andhra Pradesh',
    notes           VARCHAR(1000)
);

-- Seed authority records (deterministic lookup table)
INSERT INTO authority_records (dept_code, dept_name, jurisdiction, portal_url, grievance_url, helpline) VALUES
('NHAI',          'National Highways Authority of India',
 'National Highways (NH-prefix roads)',
 'https://nhai.gov.in', 'https://rajmargyatra.nhai.gov.in', '1033'),
('AP_RNB',        'Andhra Pradesh Roads & Buildings Department',
 'State Highways, Major District Roads',
 'https://randb.ap.gov.in', 'https://pgr.ap.gov.in', '1902'),
('CDMA_ULB',      'Commissioner & Director of Municipal Administration (CDMA) — Urban Local Bodies',
 'Internal roads within municipal corporations and municipalities',
 'https://cdma.ap.gov.in', 'https://puraaseva.ap.gov.in', '1800-425-6655'),
('AP_PRED_PMGSY', 'Andhra Pradesh Panchayat Raj Engineering Department (PMGSY Rural Roads)',
 'Rural Pradhan Mantri Gram Sadak Yojana roads',
 'https://pred.ap.gov.in', 'https://omms.nic.in', '1800-11-6565'),
('UNKNOWN',       'Authority Not Determined',
 'Jurisdiction could not be established from available records',
 NULL, NULL, NULL);

-- ── CONTRACTOR / TENDER RECORDS (DLP investigation) ──────────
CREATE TABLE IF NOT EXISTS contractor_records (
    id                  BIGINT          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    authority_id        BIGINT          REFERENCES authority_records(id),
    tender_id           VARCHAR(200),
    package_number      VARCHAR(100),
    road_name           VARCHAR(300),
    chainage_from       DOUBLE PRECISION,  -- km
    chainage_to         DOUBLE PRECISION,  -- km
    contractor_name     VARCHAR(300),
    contract_value_lakhs DOUBLE PRECISION,
    work_start_date     DATE,
    work_end_date       DATE,
    dlp_end_date        DATE,              -- Defect Liability Period end
    district            VARCHAR(100),
    source_url          VARCHAR(500),
    source_title        VARCHAR(300),
    verification_status VARCHAR(30)     NOT NULL DEFAULT 'UNVERIFIED',
        -- VERIFIED | UNVERIFIED | UNKNOWN
    accessed_at         TIMESTAMP,
    notes               VARCHAR(1000)
);
CREATE INDEX idx_contractor_road ON contractor_records(road_name);
CREATE INDEX idx_contractor_authority ON contractor_records(authority_id);

-- ── INVESTIGATION RESULTS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS investigation_results (
    id                      BIGINT          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    road_issue_id           BIGINT          NOT NULL UNIQUE REFERENCES road_issues(id),
    -- Authority determination
    candidate_authority_id  BIGINT          REFERENCES authority_records(id),
    authority_reason        VARCHAR(500),
    authority_confidence    VARCHAR(30)     NOT NULL DEFAULT 'UNKNOWN',
        -- HIGH | MEDIUM | LOW | UNKNOWN
    -- DLP
    dlp_applicable          BOOLEAN         NOT NULL DEFAULT FALSE,
    dlp_contractor_id       BIGINT          REFERENCES contractor_records(id),
    dlp_end_date            DATE,
    -- Evidence hierarchy tier (1=Verified official, 4=Not found)
    evidence_tier           INT             NOT NULL DEFAULT 4,
    evidence_summary        VARCHAR(2000),
    missing_information     VARCHAR(1000),
    -- Agent metadata
    investigated_by         VARCHAR(50)     NOT NULL DEFAULT 'DETERMINISTIC_RULES',
        -- DETERMINISTIC_RULES | AI_AGENT_MOCK | AI_AGENT_LIVE
    investigated_at         TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    investigation_notes     VARCHAR(2000)
);

-- ── COMPLAINTS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS complaints (
    id                  BIGINT          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid                VARCHAR(36)     NOT NULL UNIQUE,
    road_issue_id       BIGINT          NOT NULL REFERENCES road_issues(id),
    -- Authority
    authority_id        BIGINT          REFERENCES authority_records(id),
    -- Content
    subject             VARCHAR(500)    NOT NULL,
    body_text           VARCHAR(10000)  NOT NULL,
    complainant_name    VARCHAR(200),
    complainant_email   VARCHAR(200),
    complainant_phone   VARCHAR(20),
    -- Lifecycle
    status              VARCHAR(40)     NOT NULL DEFAULT 'DRAFT',
        -- DRAFT | AWAITING_REVIEW | APPROVED | SUBMITTED | SIMULATED | FAILED | WITHDRAWN
    submission_stage    VARCHAR(10)     NOT NULL DEFAULT 'A',
        -- A (simulated) | B (assisted) | C (automated if ever supported)
    -- Simulated submission data (Stage A)
    simulated_ref_id    VARCHAR(100),   -- e.g. SIM-AP-PGRS-2026-00482
    simulated_at        TIMESTAMP,
    simulated_warning   VARCHAR(500),   -- full warning text stored with receipt
    -- Real submission data (Stage B+)
    official_ref_id     VARCHAR(200),
    submitted_at        TIMESTAMP,
    -- Timestamps
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    approved_at         TIMESTAMP,
    updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT complaints_status_chk CHECK (status IN (
        'DRAFT','AWAITING_REVIEW','APPROVED','SUBMITTED','SIMULATED','FAILED','WITHDRAWN'))
);
CREATE INDEX idx_complaints_uuid ON complaints(uuid);
CREATE INDEX idx_complaints_issue ON complaints(road_issue_id);
CREATE INDEX idx_complaints_status ON complaints(status);

-- ── NOTIFICATION EVENTS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_events (
    id              BIGINT          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_type      VARCHAR(60)     NOT NULL,
        -- JOURNEY_STARTED | JOURNEY_STOPPED | ISSUE_DETECTED |
        -- COMPLAINT_DRAFTED | COMPLAINT_SIMULATED | COMPLAINT_SUBMITTED |
        -- TEST_EMAIL | EMAIL_FAILED
    reference_id    BIGINT,         -- journey_id, issue_id, or complaint_id
    reference_type  VARCHAR(30),    -- JOURNEY | ISSUE | COMPLAINT
    recipient_email VARCHAR(200),
    subject         VARCHAR(500),
    sent            BOOLEAN         NOT NULL DEFAULT FALSE,
    sent_at         TIMESTAMP,
    failure_reason  VARCHAR(1000),
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_notifications_type ON notification_events(event_type);
CREATE INDEX idx_notifications_ref ON notification_events(reference_id, reference_type);

-- ── AUDIT EVENTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_events (
    id              BIGINT          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_type      VARCHAR(100)    NOT NULL,
    entity_type     VARCHAR(50),
    entity_id       VARCHAR(100),
    actor           VARCHAR(100)    DEFAULT 'SYSTEM',
    description     VARCHAR(2000),
    ip_address      VARCHAR(45),
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_audit_entity ON audit_events(entity_type, entity_id);
CREATE INDEX idx_audit_created_at ON audit_events(created_at);
