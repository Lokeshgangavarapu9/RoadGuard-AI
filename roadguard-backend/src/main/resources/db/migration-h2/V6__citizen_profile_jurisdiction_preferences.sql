-- =========================================================================
-- RoadGuard AI — V6 Citizen Profile Jurisdiction & Complaint Preferences
-- =========================================================================

-- Add dedicated address, jurisdiction, preference, and verification fields to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(30) DEFAULT 'English';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS mobile_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- Address & Jurisdiction fields
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS state VARCHAR(100) DEFAULT 'Andhra Pradesh';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS district VARCHAR(100);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS city_or_municipality VARCHAR(150);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS ulb_name VARCHAR(150);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS ward_number VARCHAR(50);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS locality VARCHAR(150);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS pin_code VARCHAR(20);

-- Complaint & Privacy Preferences
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS preferred_notification_channel VARCHAR(30) DEFAULT 'SMS';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS consent_device_location BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS consent_inspection_photos BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS communication_preferences VARCHAR(500);
