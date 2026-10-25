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

    public UserProfileService(UserProfileRepository profileRepository, ConnectedPortalRepository portalRepository) {
        this.profileRepository = profileRepository;
        this.portalRepository = portalRepository;
    }

    @Transactional
    public UserProfile getProfile() {
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
            empty.setAddress("");
            empty.setPrimaryVrn("");
            empty.setVehicleType("CAR");
            empty.setAdditionalVehicles("");
            return empty;
        }
        return profile;
    }

    @Transactional
    public UserProfile updateProfile(UserProfile request) {
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
        existing.setAddress(request.getAddress() != null ? request.getAddress().trim() : null);
        existing.setPrimaryVrn(request.getPrimaryVrn() != null ? request.getPrimaryVrn().trim() : null);
        existing.setVehicleType(request.getVehicleType() != null ? request.getVehicleType().trim() : "CAR");
        existing.setAdditionalVehicles(request.getAdditionalVehicles() != null ? request.getAdditionalVehicles().trim() : null);
        existing.setUpdatedAt(Instant.now());

        log.info("Persisted genuine citizen profile (VRN: {})", existing.getPrimaryVrnNormalized());
        return profileRepository.save(existing);
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
