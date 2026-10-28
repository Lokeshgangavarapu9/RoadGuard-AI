-- =========================================================================
-- RoadGuard AI — V5 Government Portal Automation Worker & Audit Trail
-- =========================================================================

-- 1. Upgrade Complaints Table check constraint for full state machine
ALTER TABLE complaints DROP CONSTRAINT IF EXISTS complaints_status_chk;
ALTER TABLE complaints ADD CONSTRAINT complaints_status_chk CHECK (status IN (
    'DRAFT',
    'EVIDENCE_READY',
    'AWAITING_CITIZEN_APPROVAL',
    'READY_TO_SUBMIT',
    'SUBMITTING',
    'AWAITING_CITIZEN',
    'SUBMISSION_UNVERIFIED',
    'SUBMITTED',
    'TRACKING',
    'RESOLVED',
    'FOLLOW_UP_REQUIRED',
    'FAILED',
    -- Legacy values for backward compatibility
    'AWAITING_REVIEW',
    'VERIFIED',
    'COMPLAINT_PREPARED',
    'AWAITING_USER_ACTION',
    'SUBMISSION_IN_PROGRESS',
    'SUBMISSION_FAILED',
    'SUBMISSION_UNKNOWN',
    'APPROVED',
    'SIMULATED',
    'WITHDRAWN'
));

-- 2. Automation Jobs Table
CREATE TABLE IF NOT EXISTS automation_jobs (
    id                          BIGINT          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid                        VARCHAR(36)     NOT NULL UNIQUE,
    complaint_id                BIGINT          NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    portal_id                   VARCHAR(50)     NOT NULL, -- RAJMARGYATRA_NHAI | AP_CDMA | MOCK_PORTAL
    mode                        VARCHAR(20)     NOT NULL DEFAULT 'MOCK', -- MOCK | LIVE
    status                      VARCHAR(40)     NOT NULL DEFAULT 'PENDING',
        -- PENDING | DISPATCHED | RUNNING | AWAITING_OTP | AWAITING_CAPTCHA | SUBMITTED | COMPLETED | FAILED | CANCELLED
    otp_prompt                  VARCHAR(500),
    otp_code                    VARCHAR(20),    -- ephemeral; cleared once used
    captcha_prompt              VARCHAR(500),
    captcha_solved              BOOLEAN         NOT NULL DEFAULT FALSE,
    official_reference_number   VARCHAR(100),
    official_confirmation_text  VARCHAR(2000),
    submission_screenshot_path  VARCHAR(500),
    error_message               VARCHAR(1000),
    worker_id                   VARCHAR(100),
    worker_heartbeat_at         TIMESTAMP,
    created_at                  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_autojobs_complaint ON automation_jobs(complaint_id);
CREATE INDEX IF NOT EXISTS idx_autojobs_status ON automation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_autojobs_uuid ON automation_jobs(uuid);

-- 3. Filing Audit Logs Table (Full filing trail with screenshots and timestamps)
CREATE TABLE IF NOT EXISTS filing_audit_logs (
    id                  BIGINT          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    job_id              BIGINT          REFERENCES automation_jobs(id) ON DELETE CASCADE,
    complaint_id        BIGINT          REFERENCES complaints(id) ON DELETE CASCADE,
    portal_name         VARCHAR(100)    NOT NULL,
    action              VARCHAR(100)    NOT NULL,
        -- OPEN_PORTAL | DETECT_LOGIN | REQUEST_OTP | SUPPLY_OTP | AUTH_SUCCESS |
        -- FILL_LOCATION | UPLOAD_EVIDENCE | CITIZEN_APPROVED | CLICK_SUBMIT |
        -- EXTRACT_REFERENCE | PORTAL_CHANGED | ERROR | STATUS_CHECK
    result              VARCHAR(50)     NOT NULL DEFAULT 'SUCCESS',
        -- SUCCESS | AWAITING_HUMAN | FAILED | DIAGNOSTIC
    details             VARCHAR(2000),
    screenshot_path     VARCHAR(500),
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_job ON filing_audit_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_audit_complaint ON filing_audit_logs(complaint_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON filing_audit_logs(created_at);
