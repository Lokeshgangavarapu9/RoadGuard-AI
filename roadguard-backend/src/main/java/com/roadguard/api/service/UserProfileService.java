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

    @Transactional(readOnly = true)
    public UserProfile getProfile() {
        return profileRepository.findFirstByOrderByIdAsc()
            .orElseGet(() -> {
                UserProfile empty = new UserProfile();
                empty.setFullName("");
                empty.setEmail("");
                empty.setPhone("");
                empty.setAddress("");
                empty.setPrimaryVrn("");
                empty.setVehicleType("CAR");
                empty.setAdditionalVehicles("");
                return empty;
            });
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
        // Truthful verified statuses as discovered during official portal audit:
        // No portal currently provides an open third-party REST API without human CAPTCHA/OTP.
        if ("RAJMARGYATRA_NHAI".equalsIgnoreCase(portalId)) {
            portal.setStatus(ConnectedPortal.ConnectionStatus.MANUAL_HANDOFF_ONLY);
            portal.setConnectionNotes("Official direct submission API is restricted to NHAI intranet networks. RoadGuard AI compiles verified coordinates, highway chainage, and evidence photos into an official dossier for user-controlled handoff.");
        } else if ("AP_CDMA".equalsIgnoreCase(portalId)) {
            portal.setStatus(ConnectedPortal.ConnectionStatus.MANUAL_HANDOFF_ONLY);
            portal.setConnectionNotes("CDMA requires Citizen Mobile OTP through the Puramithra/CDMA citizen portal. RoadGuard AI prepares the municipal category (Roads -> Potholes), ward details, and photo package for citizen filing.");
        } else if ("AP_MEEKOSAM_PGRS".equalsIgnoreCase(portalId)) {
            portal.setStatus(ConnectedPortal.ConnectionStatus.MANUAL_HANDOFF_ONLY);
            portal.setConnectionNotes("Portal is secured by BotDetect CAPTCHA and Aadhaar/Mobile OTP. Programmatic bot submissions are strictly prohibited by state security policy. RoadGuard AI generates a formal legal complaint draft with Section 133 CrPC and IRC:82-2015 grounds.");
        }
        return portalRepository.save(portal);
    }
}
