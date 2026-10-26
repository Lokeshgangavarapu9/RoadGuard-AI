package com.roadguard.api.dto;

import com.roadguard.api.entity.FilingAuditLog;
import java.time.Instant;

public record FilingAuditLogDto(
    Long id,
    Long jobId,
    Long complaintId,
    String portalName,
    String action,
    String result,
    String details,
    String screenshotPath,
    Instant createdAt
) {
    public static FilingAuditLogDto fromEntity(FilingAuditLog log) {
        return new FilingAuditLogDto(
            log.getId(),
            log.getJob() != null ? log.getJob().getId() : null,
            log.getComplaint() != null ? log.getComplaint().getId() : null,
            log.getPortalName(),
            log.getAction(),
            log.getResult(),
            log.getDetails(),
            log.getScreenshotPath(),
            log.getCreatedAt()
        );
    }
}
