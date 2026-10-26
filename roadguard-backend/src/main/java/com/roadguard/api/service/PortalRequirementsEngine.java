package com.roadguard.api.service;

import com.roadguard.api.dto.PortalReadinessDto;
import com.roadguard.api.dto.ProfileReadinessSummaryDto;
import com.roadguard.api.entity.UserProfile;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Portal Requirements Engine
 * Maintains verified official prerequisites for supported government grievance portals
 * and produces truthful, dynamic readiness evaluations without hardcoded falsehoods.
 */
@Service
public class PortalRequirementsEngine {

    /**
     * Evaluates a single portal's readiness against the citizen's actual profile.
     */
    public PortalReadinessDto evaluatePortalReadiness(String portalId, UserProfile profile) {
        String pId = portalId != null ? portalId.toUpperCase() : "";

        if ("RAJMARGYATRA_NHAI".equals(pId)) {
            return evaluateRajmargyatra(profile);
        } else if ("AP_CDMA".equals(pId)) {
            return evaluateApCdma(profile);
        } else if ("AP_MEEKOSAM_PGRS".equals(pId)) {
            return evaluateMeeKosam(profile);
        } else if ("MOCK_PORTAL".equals(pId)) {
            return evaluateMockPortal(profile);
        }

        // Generic fallback
        return new PortalReadinessDto(
            portalId,
            "Government Portal",
            "https://india.gov.in",
            "Public Roadways",
            "CITIZEN_HANDOFF",
            profile != null && profile.isRegistered(),
            false,
            List.of(),
            List.of("Portal configuration unverified"),
            List.of(),
            "UNVERIFIED",
            "Integration not configured or verified for this authority.",
            "Manual submission via official website required."
        );
    }

    private PortalReadinessDto evaluateRajmargyatra(UserProfile profile) {
        List<String> satisfied = new ArrayList<>();
        List<String> missingReq = new ArrayList<>();
        List<String> missingOpt = new ArrayList<>();

        if (profile != null) {
            if (profile.getFullName() != null && !profile.getFullName().isBlank()) {
                satisfied.add("Full Legal Name");
            } else {
                missingReq.add("Full Legal Name");
            }

            if (profile.getPhone() != null && profile.getPhone().replaceAll("[^0-9]", "").length() >= 10) {
                satisfied.add("10-Digit Mobile Number (for SMS OTP login)");
            } else {
                missingReq.add("10-Digit Mobile Number");
            }

            if (profile.getEmail() != null && profile.getEmail().contains("@")) {
                satisfied.add("Email Address");
            } else {
                missingOpt.add("Email Address");
            }

            if (profile.getPrimaryVrn() != null && !profile.getPrimaryVrn().isBlank()) {
                satisfied.add("Vehicle Registration Number");
            } else {
                missingOpt.add("Vehicle Registration Number");
            }
        } else {
            missingReq.add("Full Legal Name");
            missingReq.add("10-Digit Mobile Number");
        }

        boolean readyToPrepare = missingReq.isEmpty();
        boolean readyToSubmit = readyToPrepare; // Submission also requires mobile OTP at filing time

        String summary = readyToPrepare
            ? "Ready for automated NHAI complaint preparation. Live submission requires citizen SMS OTP."
            : "Missing required contact details: " + String.join(", ", missingReq);

        String nextAction = readyToPrepare
            ? "Citizen must provide SMS OTP when Playwright worker opens Rajmargyatra login."
            : "Complete missing personal contact information.";

        return new PortalReadinessDto(
            "RAJMARGYATRA_NHAI",
            "NHAI Rajmargyatra Official Portal",
            "https://rajmargyatra.nhai.gov.in/complaints",
            "National Highways (NH corridors across India)",
            "AUTOMATED_WORKER_WITH_OTP",
            readyToPrepare,
            readyToSubmit,
            satisfied,
            missingReq,
            missingOpt,
            "MOBILE_OTP",
            summary,
            nextAction
        );
    }

    private PortalReadinessDto evaluateApCdma(UserProfile profile) {
        List<String> satisfied = new ArrayList<>();
        List<String> missingReq = new ArrayList<>();
        List<String> missingOpt = new ArrayList<>();

        if (profile != null) {
            if (profile.getFullName() != null && !profile.getFullName().isBlank()) {
                satisfied.add("Full Legal Name");
            } else {
                missingReq.add("Full Legal Name");
            }

            if (profile.getPhone() != null && profile.getPhone().replaceAll("[^0-9]", "").length() >= 10) {
                satisfied.add("10-Digit Mobile Number (for Puramithra OTP)");
            } else {
                missingReq.add("10-Digit Mobile Number");
            }

            if (profile.getCityOrMunicipality() != null && !profile.getCityOrMunicipality().isBlank()) {
                satisfied.add("Municipality / Urban Local Body");
            } else if (profile.getUlbName() != null && !profile.getUlbName().isBlank()) {
                satisfied.add("Municipality / Urban Local Body");
            } else {
                missingReq.add("Municipality / Urban Local Body (ULB)");
            }

            if (profile.getWardNumber() != null && !profile.getWardNumber().isBlank()) {
                satisfied.add("Ward Number");
            } else {
                missingOpt.add("Municipal Ward Number");
            }

            if (profile.getDistrict() != null && !profile.getDistrict().isBlank()) {
                satisfied.add("District");
            } else {
                missingOpt.add("District");
            }
        } else {
            missingReq.add("Full Legal Name");
            missingReq.add("10-Digit Mobile Number");
            missingReq.add("Municipality / Urban Local Body");
        }

        boolean readyToPrepare = missingReq.isEmpty();
        boolean readyToSubmit = readyToPrepare;

        String summary = readyToPrepare
            ? "Ready for municipal complaint filing. Citizen mobile OTP required at filing time."
            : "Missing municipal routing fields: " + String.join(", ", missingReq);

        String nextAction = readyToPrepare
            ? "Provide SMS OTP when worker opens the CDMA / Puramithra portal."
            : "Select your Municipality / Urban Local Body under Address & Jurisdiction.";

        return new PortalReadinessDto(
            "AP_CDMA",
            "Andhra Pradesh CDMA / Puramithra",
            "https://cdma.ap.gov.in/services/grievances/",
            "Municipal & Urban Local Body Roads (123+ AP Cities)",
            "AUTOMATED_WORKER_WITH_OTP",
            readyToPrepare,
            readyToSubmit,
            satisfied,
            missingReq,
            missingOpt,
            "MOBILE_OTP",
            summary,
            nextAction
        );
    }

    private PortalReadinessDto evaluateMeeKosam(UserProfile profile) {
        List<String> satisfied = new ArrayList<>();
        List<String> missingReq = new ArrayList<>();
        List<String> missingOpt = new ArrayList<>();

        if (profile != null) {
            if (profile.getFullName() != null && !profile.getFullName().isBlank()) {
                satisfied.add("Full Legal Name");
            } else {
                missingReq.add("Full Legal Name");
            }

            if (profile.getPhone() != null && profile.getPhone().replaceAll("[^0-9]", "").length() >= 10) {
                satisfied.add("10-Digit Mobile Number");
            } else {
                missingReq.add("10-Digit Mobile Number");
            }

            if (profile.getDistrict() != null && !profile.getDistrict().isBlank()) {
                satisfied.add("District");
            } else {
                missingReq.add("District");
            }
        } else {
            missingReq.add("Full Legal Name");
            missingReq.add("10-Digit Mobile Number");
            missingReq.add("District");
        }

        boolean readyToPrepare = missingReq.isEmpty();

        return new PortalReadinessDto(
            "AP_MEEKOSAM_PGRS",
            "Andhra Pradesh Mee Kosam / PGRS",
            "https://meekosam.ap.gov.in/",
            "State Highways, Major District Roads & Rural PMGSY",
            "CITIZEN_HANDOFF_WITH_CAPTCHA",
            readyToPrepare,
            false, // Automated filing not supported due to BotDetect CAPTCHA + Aadhaar OTP
            satisfied,
            missingReq,
            missingOpt,
            "AADHAAR_OTP_CAPTCHA",
            "Manual assisted handoff only. Portal enforces BotDetect CAPTCHA & Aadhaar OTP.",
            "RoadGuard AI prepares formal complaint dossier for citizen to submit on meekosam.ap.gov.in."
        );
    }

    private PortalReadinessDto evaluateMockPortal(UserProfile profile) {
        List<String> satisfied = new ArrayList<>();
        List<String> missingReq = new ArrayList<>();

        if (profile != null && profile.getFullName() != null && !profile.getFullName().isBlank()) {
            satisfied.add("Full Name");
        } else {
            missingReq.add("Full Name");
        }

        if (profile != null && profile.getPhone() != null && !profile.getPhone().isBlank()) {
            satisfied.add("Mobile Number");
        } else {
            missingReq.add("Mobile Number");
        }

        return new PortalReadinessDto(
            "MOCK_PORTAL",
            "Local RoadGuard Mock Government Portal",
            "http://127.0.0.1:8089/mock-portal",
            "Local Test Harness (Simulated Grievance System)",
            "AUTOMATED_WORKER_WITH_OTP",
            missingReq.isEmpty(),
            missingReq.isEmpty(),
            satisfied,
            missingReq,
            List.of(),
            "MOBILE_OTP",
            "Local test environment. Fully automated Playwright filing with test OTP 582914.",
            "Ready for end-to-end local automated workflow testing."
        );
    }

    /**
     * Calculates the overall summary of profile completeness and readiness across portals.
     */
    public ProfileReadinessSummaryDto calculateProfileSummary(UserProfile profile) {
        if (profile == null) {
            return new ProfileReadinessSummaryDto(
                0,
                0,
                false,
                List.of(
                    evaluateRajmargyatra(null),
                    evaluateApCdma(null),
                    evaluateMeeKosam(null)
                ),
                List.of("Personal information not entered", "Mobile number missing", "Jurisdiction not configured"),
                "INCOMPLETE"
            );
        }

        // 1. Personal Info Score (Name, Email, Phone, Language)
        int personalScore = 0;
        if (profile.getFullName() != null && !profile.getFullName().isBlank()) personalScore += 35;
        if (profile.getPhone() != null && profile.getPhone().replaceAll("[^0-9]", "").length() >= 10) personalScore += 35;
        if (profile.getEmail() != null && profile.getEmail().contains("@")) personalScore += 20;
        if (profile.getPreferredLanguage() != null && !profile.getPreferredLanguage().isBlank()) personalScore += 10;

        // 2. Address & Jurisdiction Score
        int addressScore = 0;
        if (profile.getState() != null && !profile.getState().isBlank()) addressScore += 20;
        if (profile.getDistrict() != null && !profile.getDistrict().isBlank()) addressScore += 25;
        if ((profile.getCityOrMunicipality() != null && !profile.getCityOrMunicipality().isBlank()) ||
            (profile.getUlbName() != null && !profile.getUlbName().isBlank())) addressScore += 30;
        if (profile.getWardNumber() != null && !profile.getWardNumber().isBlank()) addressScore += 15;
        if (profile.getPinCode() != null && !profile.getPinCode().isBlank()) addressScore += 10;

        boolean contactVerified = Boolean.TRUE.equals(profile.getMobileVerified());

        List<PortalReadinessDto> portalList = List.of(
            evaluateRajmargyatra(profile),
            evaluateApCdma(profile),
            evaluateMeeKosam(profile)
        );

        List<String> missing = new ArrayList<>();
        if (profile.getFullName() == null || profile.getFullName().isBlank()) missing.add("Full legal name");
        if (profile.getPhone() == null || profile.getPhone().replaceAll("[^0-9]", "").length() < 10) missing.add("10-digit mobile number");
        if ((profile.getCityOrMunicipality() == null || profile.getCityOrMunicipality().isBlank()) &&
            (profile.getUlbName() == null || profile.getUlbName().isBlank())) missing.add("Municipality / Urban Local Body");

        String status = (personalScore >= 70 && addressScore >= 50) ? "READY" : (personalScore >= 35 ? "PARTIALLY_READY" : "INCOMPLETE");

        return new ProfileReadinessSummaryDto(
            personalScore,
            addressScore,
            contactVerified,
            portalList,
            missing,
            status
        );
    }
}
