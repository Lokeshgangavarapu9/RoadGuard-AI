-- =========================================================================
-- RoadGuard AI — V8 Add Active Complaint Index
-- =========================================================================

-- Composite index accelerating active complaint lookup for a road issue
CREATE INDEX IF NOT EXISTS idx_active_complaint_per_issue
    ON complaints(road_issue_id, status);

