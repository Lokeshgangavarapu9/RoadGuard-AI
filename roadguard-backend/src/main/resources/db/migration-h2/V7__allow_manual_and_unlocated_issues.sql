-- =========================================================================
-- RoadGuard AI — V7 Offline GPS & Manual Location Reporting Migration
-- =========================================================================

-- 1. Allow nullable latitude and longitude on road_issues for offline/GPS-off recording
ALTER TABLE road_issues ALTER COLUMN latitude DROP NOT NULL;
ALTER TABLE road_issues ALTER COLUMN longitude DROP NOT NULL;

-- 2. Add location source tracking (GPS, MANUAL_ENTRY, MANUAL_LOCATION_REQUIRED)
ALTER TABLE road_issues ADD COLUMN IF NOT EXISTS location_source VARCHAR(30) DEFAULT 'GPS';

-- 3. Add civic location fields for manual entry
ALTER TABLE road_issues ADD COLUMN IF NOT EXISTS city_or_town VARCHAR(150);
ALTER TABLE road_issues ADD COLUMN IF NOT EXISTS district VARCHAR(100);
ALTER TABLE road_issues ADD COLUMN IF NOT EXISTS state VARCHAR(100);
ALTER TABLE road_issues ADD COLUMN IF NOT EXISTS pincode VARCHAR(20);
