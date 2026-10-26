package com.roadguard.api.dto;

import java.util.List;

/**
 * Summary DTO representing global citizen profile readiness across all government portals.
 */
public record ProfileReadinessSummaryDto(
    int personalInfoCompletenessPercent,
    int addressJurisdictionCompletenessPercent,
    boolean contactVerified,
    List<PortalReadinessDto> portalReadinessList,
    List<String> globalMissingItems,
    String overallStatus
) {}
