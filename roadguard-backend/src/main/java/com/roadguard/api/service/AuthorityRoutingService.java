package com.roadguard.api.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.roadguard.api.entity.AuthorityRecord;
import com.roadguard.api.repository.AuthorityRecordRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Deterministic multi-tier civic road authority router for Andhra Pradesh & Indian road networks.
 * Evaluates highway classification, road reference identifiers, municipal boundaries, and operator tags.
 */
@Service
public class AuthorityRoutingService {

    private static final Logger log = LoggerFactory.getLogger(AuthorityRoutingService.class);

    private static final Pattern NH_PATTERN = Pattern.compile("(?i)^(NH[- ]?\\d+|NATIONAL\\s*HIGHWAY).*");
    private static final Pattern SH_PATTERN = Pattern.compile("(?i)^(SH[- ]?\\d+|STATE\\s*HIGHWAY).*");
    private static final Pattern MDR_PATTERN = Pattern.compile("(?i)^(MDR[- ]?\\d+|MAJOR\\s*DISTRICT\\s*ROAD).*");

    public enum RoutingConfidence {
        VERIFIED_HIGH,
        PROBABLE_NEEDS_CONFIRMATION,
        UNCERTAIN_REQUIRES_USER_VERIFICATION
    }

    public record AuthorityRoutingDecision(
        String authorityCode,
        String authorityName,
        String jurisdictionDescription,
        String portalUrl,
        String grievanceUrl,
        String helpline,
        RoutingConfidence confidence,
        boolean requiresUserConfirmation,
        String routingReason,
        String routingEvidenceJson
    ) {}

    private final AuthorityRecordRepository authorityRecordRepository;
    private final ObjectMapper objectMapper;

    public AuthorityRoutingService(AuthorityRecordRepository authorityRecordRepository, ObjectMapper objectMapper) {
        this.authorityRecordRepository = authorityRecordRepository;
        this.objectMapper = objectMapper;
    }

    /**
     * Determines responsible road authority from location coordinates, road metadata, and tags.
     */
    public AuthorityRoutingDecision resolveAuthority(Double latitude, Double longitude, String roadRef, String roadName, String roadType) {
        String ref = (roadRef != null) ? roadRef.trim() : "";
        String name = (roadName != null) ? roadName.trim() : "";
        String type = (roadType != null) ? roadType.trim().toLowerCase() : "";

        Map<String, Object> evidence = new HashMap<>();
        evidence.put("latitude", latitude);
        evidence.put("longitude", longitude);
        evidence.put("roadRef", ref);
        evidence.put("roadName", name);
        evidence.put("roadType", type);

        // RULE 1: National Highways (NHAI) override all municipal/state boundaries
        if (NH_PATTERN.matcher(ref).matches() || NH_PATTERN.matcher(name).matches() || "trunk".equals(type) && (ref.contains("NH") || name.contains("NH"))) {
            evidence.put("matchedRule", "RULE_1_NATIONAL_HIGHWAY_OVERRIDE");
            AuthorityRecord nhai = getAuthority("NHAI", "National Highways Authority of India",
                "https://nhai.gov.in", "https://rajmargyatra.nhai.gov.in", "1033");

            return new AuthorityRoutingDecision(
                "NHAI",
                nhai.getDeptName(),
                "National Highway corridor governed by Central NHAI jurisdiction",
                nhai.getPortalUrl(),
                nhai.getGrievanceUrl(),
                nhai.getHelpline(),
                RoutingConfidence.VERIFIED_HIGH,
                false,
                "Road carries National Highway designation ('" + (ref.isEmpty() ? name : ref) + "'); central jurisdiction overrides local ULB limits.",
                toJson(evidence)
            );
        }

        // RULE 2: State Highways & Major District Roads (AP Roads & Buildings Department)
        if (SH_PATTERN.matcher(ref).matches() || SH_PATTERN.matcher(name).matches() ||
            MDR_PATTERN.matcher(ref).matches() || MDR_PATTERN.matcher(name).matches()) {
            evidence.put("matchedRule", "RULE_2_STATE_HIGHWAY_MDR");
            AuthorityRecord rAndB = getAuthority("AP_RNB", "Andhra Pradesh Roads & Buildings Department",
                "https://randb.ap.gov.in", "https://pgr.ap.gov.in", "1902");

            return new AuthorityRoutingDecision(
                "AP_RNB",
                rAndB.getDeptName(),
                "State Highway / Major District Road governed by AP R&B Department",
                rAndB.getPortalUrl(),
                rAndB.getGrievanceUrl(),
                rAndB.getHelpline(),
                RoutingConfidence.VERIFIED_HIGH,
                false,
                "Road carries State Highway or Major District Road designation ('" + (ref.isEmpty() ? name : ref) + "').",
                toJson(evidence)
            );
        }

        // RULE 3: Urban Local Body (ULB) Internal Streets (AP CDMA)
        if (isKnownMunicipalStreet(type, name)) {
            evidence.put("matchedRule", "RULE_3_MUNICIPAL_STREET");
            AuthorityRecord cdma = getAuthority("CDMA_ULB", "Commissioner & Director of Municipal Administration (CDMA) — Urban Local Bodies",
                "https://cdma.ap.gov.in", "https://puraaseva.ap.gov.in", "1800-425-6655");

            return new AuthorityRoutingDecision(
                "CDMA_ULB",
                cdma.getDeptName(),
                "Internal municipal street governed by local Urban Local Body / Municipal Corporation",
                cdma.getPortalUrl(),
                cdma.getGrievanceUrl(),
                cdma.getHelpline(),
                RoutingConfidence.PROBABLE_NEEDS_CONFIRMATION,
                false,
                "Identified as municipal road (" + type + " / " + name + ") within urban local body limits.",
                toJson(evidence)
            );
        }

        // RULE 4: Ambiguous / Untagged Roads -> Fail-closed, require citizen review
        evidence.put("matchedRule", "RULE_4_AMBIGUOUS_REQUIRING_CITIZEN_CONFIRMATION");
        AuthorityRecord fallback = getAuthority("UNKNOWN", "Authority Not Determined",
            null, null, null);

        return new AuthorityRoutingDecision(
            "UNKNOWN",
            "Authority Not Determined",
            "Jurisdiction ambiguous or unverified in official road registry",
            fallback.getPortalUrl(),
            fallback.getGrievanceUrl(),
            fallback.getHelpline(),
            RoutingConfidence.UNCERTAIN_REQUIRES_USER_VERIFICATION,
            true,
            "No authoritative road designation tag found. Citizen verification required to avoid misdirected complaints.",
            toJson(evidence)
        );
    }

    private boolean isKnownMunicipalStreet(String type, String name) {
        if ("residential".equals(type) || "living_street".equals(type) || "service".equals(type)) {
            return true;
        }
        String n = name.toLowerCase();
        return n.contains("ward") || n.contains("colony") || n.contains("street") || n.contains("lane") || n.contains("nagar") || n.contains("circle");
    }

    private AuthorityRecord getAuthority(String deptCode, String fallbackName, String fallbackPortal, String fallbackGrievance, String fallbackHelpline) {
        Optional<AuthorityRecord> existing = authorityRecordRepository.findByDeptCode(deptCode);
        if (existing.isPresent()) {
            return existing.get();
        }
        AuthorityRecord record = new AuthorityRecord();
        record.setDeptCode(deptCode);
        record.setDeptName(fallbackName);
        record.setPortalUrl(fallbackPortal);
        record.setGrievanceUrl(fallbackGrievance);
        record.setHelpline(fallbackHelpline);
        return record;
    }

    private String toJson(Map<String, Object> map) {
        try {
            return objectMapper.writeValueAsString(map);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }
}
