package com.roadguard.api.service;

import com.roadguard.api.entity.ConnectedPortal;
import com.roadguard.api.entity.UserProfile;
import com.roadguard.api.repository.ConnectedPortalRepository;
import com.roadguard.api.repository.UserProfileRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
public class UserProfileService {

    private static final Logger log = LoggerFactory.getLogger(UserProfileService.class);

    private final UserProfileRepository profileRepository;
    private final ConnectedPortalRepository portalRepository;
    private final PortalRequirementsEngine requirementsEngine;
    private final java.util.concurrent.ConcurrentMap<String, UserProfile> sessionProfiles = new java.util.concurrent.ConcurrentHashMap<>();

    public UserProfileService(
        UserProfileRepository profileRepository,
        ConnectedPortalRepository portalRepository,
        PortalRequirementsEngine requirementsEngine
    ) {
        this.profileRepository = profileRepository;
        this.portalRepository = portalRepository;
        this.requirementsEngine = requirementsEngine;
    }

    @Transactional
    public UserProfile getProfile() {
        return getProfile(null);
    }

    @Transactional
    public UserProfile getProfile(String sessionId) {
        if (sessionId != null && !sessionId.isBlank() && sessionProfiles.containsKey(sessionId)) {
            return sessionProfiles.get(sessionId);
        }
        UserProfile profile = profileRepository.findFirstByOrderByIdAsc().orElse(null);
        if (profile != null) {
            // Anti-mock guard: purge legacy seeded demo profile from database
            boolean isLegacyDemo = "lokesh.citizen@roadguard.local".equalsIgnoreCase(profile.getEmail())
                || ("Lokesh Kumar".equalsIgnoreCase(profile.getFullName()) && "AP16AB1234".equalsIgnoreCase(profile.getPrimaryVrnNormalized()))
                || "+91 98765 43210".equals(profile.getPhone());

            if (isLegacyDemo) {
                log.warn("Purging legacy mock demo citizen profile (id: {}, email: {}) from database", profile.getId(), profile.getEmail());
                profileRepository.delete(profile);
                profile = null;
            }
        }

        if (profile == null) {
            UserProfile empty = new UserProfile();
            empty.setFullName("");
            empty.setEmail("");
            empty.setPhone("");
            empty.setPreferredLanguage("English");
            empty.setAddress("");
            empty.setState("Andhra Pradesh");
            empty.setDistrict("");
            empty.setCityOrMunicipality("");
            empty.setUlbName("");
            empty.setWardNumber("");
            empty.setLocality("");
            empty.setPinCode("");
            empty.setPrimaryVrn("");
            empty.setVehicleType("CAR");
            empty.setAdditionalVehicles("");
            empty.setPreferredNotificationChannel("SMS");
            empty.setConsentDeviceLocation(true);
            empty.setConsentInspectionPhotos(true);
            empty.setCommunicationPreferences("");
            if (sessionId != null && !sessionId.isBlank()) {
                sessionProfiles.put(sessionId, empty);
            }
            return empty;
        }
        if (sessionId != null && !sessionId.isBlank()) {
            sessionProfiles.put(sessionId, profile);
        }
        return profile;
    }

    @Transactional
    public UserProfile updateProfile(UserProfile request) {
        return updateProfile(null, request);
    }

    @Transactional
    public UserProfile updateProfile(String sessionId, UserProfile request) {
        if (request == null) {
            throw new IllegalArgumentException("Profile request body cannot be null.");
        }
        if (request.getFullName() == null || request.getFullName().trim().isEmpty()) {
            throw new IllegalArgumentException("Full name cannot be blank.");
        }
        if (request.getEmail() == null || !request.getEmail().contains("@")) {
            throw new IllegalArgumentException("A valid email address is required.");
        }

        String effectivePhone = request.getPhone();
        if (effectivePhone == null || effectivePhone.trim().isEmpty()) {
            effectivePhone = request.getPhoneNumber();
        }
        if (effectivePhone == null || effectivePhone.replaceAll("[^0-9]", "").length() < 10) {
            throw new IllegalArgumentException("A valid 10-digit phone number is required.");
        }

        UserProfile existing = profileRepository.findFirstByOrderByIdAsc()
            .orElseGet(UserProfile::new);

        existing.setFullName(request.getFullName().trim());
        existing.setEmail(request.getEmail().trim());
        existing.setPhone(effectivePhone.trim());
        if (request.getPreferredLanguage() != null) existing.setPreferredLanguage(request.getPreferredLanguage().trim());

        // Address & Jurisdiction
        existing.setAddress(request.getAddress() != null ? request.getAddress().trim() : null);
        existing.setState(request.getState() != null ? request.getState().trim() : "Andhra Pradesh");
        existing.setDistrict(request.getDistrict() != null ? request.getDistrict().trim() : null);
        existing.setCityOrMunicipality(request.getCityOrMunicipality() != null ? request.getCityOrMunicipality().trim() : null);
        existing.setUlbName(request.getUlbName() != null ? request.getUlbName().trim() : null);
        existing.setWardNumber(request.getWardNumber() != null ? request.getWardNumber().trim() : null);
        existing.setLocality(request.getLocality() != null ? request.getLocality().trim() : null);
        existing.setPinCode(request.getPinCode() != null ? request.getPinCode().trim() : null);

        // Vehicle info
        existing.setPrimaryVrn(request.getPrimaryVrn() != null ? request.getPrimaryVrn().trim() : null);
        existing.setVehicleType(request.getVehicleType() != null ? request.getVehicleType().trim() : "CAR");
        existing.setAdditionalVehicles(request.getAdditionalVehicles() != null ? request.getAdditionalVehicles().trim() : null);

        // Preferences & Consent
        if (request.getPreferredNotificationChannel() != null) existing.setPreferredNotificationChannel(request.getPreferredNotificationChannel().trim());
        if (request.getConsentDeviceLocation() != null) existing.setConsentDeviceLocation(request.getConsentDeviceLocation());
        if (request.getConsentInspectionPhotos() != null) existing.setConsentInspectionPhotos(request.getConsentInspectionPhotos());
        if (request.getCommunicationPreferences() != null) existing.setCommunicationPreferences(request.getCommunicationPreferences().trim());

        existing.setUpdatedAt(Instant.now());

        log.info("Persisted genuine citizen profile for '{}' (State: {}, District: {})",
            existing.getFullName(), existing.getState(), existing.getDistrict());
        UserProfile saved = profileRepository.save(existing);
        if (sessionId != null && !sessionId.isBlank()) {
            sessionProfiles.put(sessionId, saved);
        }
        return saved;
    }

    @Transactional(readOnly = true)
    public com.roadguard.api.dto.ProfileReadinessSummaryDto getProfileReadiness() {
        UserProfile profile = getProfile();
        return requirementsEngine.calculateProfileSummary(profile);
    }

    @Transactional(readOnly = true)
    public List<ConnectedPortal> getConnectedPortals() {
        return portalRepository.findAllByOrderByIdAsc();
    }

    @Transactional
    public ConnectedPortal checkPortalStatus(String portalId) {
        ConnectedPortal portal = portalRepository.findByPortalId(portalId)
            .orElseThrow(() -> new IllegalArgumentException("Unknown portal ID: " + portalId));

        portal.setLastVerifiedAt(Instant.now());
        // Truthful verified statuses:
        // No government portal provides an open, unauthenticated REST API without citizen OTP or CAPTCHA.
        // Web browser Same-Origin Policy strictly prohibits cross-origin reading of session tokens or cookies.
        if ("RAJMARGYATRA_NHAI".equalsIgnoreCase(portalId)) {
            portal.setStatus(ConnectedPortal.ConnectionStatus.MANUAL_HANDOFF_ONLY);
            portal.setOfficialUrl("https://rajmargyatra.nhai.gov.in/complaints");
            portal.setConnectionNotes("Citizen Mobile OTP login required. Due to browser security (Same-Origin Policy), external web apps cannot inspect active sessions across browser tabs. Track complaint status directly on Rajmargyatra under 'View complaint status'.");
        } else if ("AP_CDMA".equalsIgnoreCase(portalId)) {
            portal.setStatus(ConnectedPortal.ConnectionStatus.MANUAL_HANDOFF_ONLY);
            portal.setOfficialUrl("https://cdma.ap.gov.in/services/grievances/");
            portal.setConnectionNotes("Citizen Puramithra/CDMA Mobile OTP login required. Browser Same-Origin Policy prevents reading active login sessions across tabs. Track municipal grievance status directly on the CDMA portal under 'Services -> Grievances'.");
        } else if ("AP_MEEKOSAM_PGRS".equalsIgnoreCase(portalId)) {
            portal.setStatus(ConnectedPortal.ConnectionStatus.MANUAL_HANDOFF_ONLY);
            portal.setOfficialUrl("https://meekosam.ap.gov.in/");
            portal.setConnectionNotes("Portal secured by BotDetect CAPTCHA & Aadhaar OTP. Automatic status polling is not supported. Use the official portal to track state grievance progress.");
        }
        return portalRepository.save(portal);
    }
}
