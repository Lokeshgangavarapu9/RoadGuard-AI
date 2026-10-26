package com.roadguard.api.dto;

import java.util.List;
import java.util.Map;

/**
 * DTO detailing the readiness of the citizen's profile for filing on a specific government portal.
 */
public record PortalReadinessDto(
    String portalId,
    String portalName,
    String officialUrl,
    String roadJurisdiction,
    String filingMethod, // "AUTOMATED_WORKER_WITH_OTP" | "CITIZEN_HANDOFF_WITH_CAPTCHA" | "MOCK_PORTAL_TEST"
    boolean isReadyToPrepare,
    boolean isReadyToSubmit,
    List<String> satisfiedFields,
    List<String> missingRequiredFields,
    List<String> missingOptionalFields,
    String authenticationMode, // "MOBILE_OTP" | "AADHAAR_OTP_CAPTCHA" | "PASSWORD_LOGIN"
    String readinessSummary,
    String nextCitizenAction
) {}
