package com.roadguard.api.dto;

import com.roadguard.api.entity.AutomationJob;
import com.roadguard.api.entity.Complaint;
import com.roadguard.api.entity.RoadIssue;

import java.time.Instant;
import java.util.List;

public record AutomationJobDto(
    Long id,
    String uuid,
    Long complaintId,
    String complaintUuid,
    String portalId,
    String mode,
    String status,
    String otpPrompt,
    String captchaPrompt,
    boolean captchaSolved,
    String officialReferenceNumber,
    String officialConfirmationText,
    String submissionScreenshotPath,
    String errorMessage,
    String workerId,
    Instant workerHeartbeatAt,
    Instant createdAt,
    Instant updatedAt,
    // Payload for worker execution
    JobPayload payload
) {
    public record JobPayload(
        String citizenName,
        String citizenEmail,
        String citizenPhone,
        String vehicleNumber,
        String address,
        String roadName,
        Double latitude,
        Double longitude,
        Double locationAccuracyM,
        String defectClass,
        String severity,
        Double confidenceScore,
        String subject,
        String description,
        String portalUrl,
        List<String> evidenceUrls
    ) {}

    public static AutomationJobDto fromEntity(AutomationJob job, List<String> evidenceUrls) {
        return fromEntity(job, evidenceUrls, null, null);
    }

    public static AutomationJobDto fromEntity(AutomationJob job, List<String> evidenceUrls, String citizenVrn, String citizenAddress) {
        Complaint c = job.getComplaint();
        RoadIssue issue = c != null ? c.getRoadIssue() : null;

        JobPayload payload = new JobPayload(
            c != null ? c.getComplainantName() : null,
            c != null ? c.getComplainantEmail() : null,
            c != null ? c.getComplainantPhone() : null,
            citizenVrn,
            citizenAddress,
            issue != null ? issue.getRoadName() : "Civic Corridor",
            issue != null ? issue.getLatitude() : null,
            issue != null ? issue.getLongitude() : null,
            issue != null ? issue.getLocationAccuracyM() : null,
            (issue != null && issue.getDefectClass() != null) ? issue.getDefectClass().name() : null,
            (issue != null && issue.getSeverity() != null) ? issue.getSeverity().name() : null,
            issue != null ? issue.getConfidenceScore() : null,
            c != null ? c.getSubject() : null,
            c != null ? c.getBodyText() : null,
            c != null ? c.getOfficialPortalUrl() : null,
            evidenceUrls
        );

        return new AutomationJobDto(
            job.getId(),
            job.getUuid(),
            c != null ? c.getId() : null,
            c != null ? c.getUuid() : null,
            job.getPortalId(),
            job.getMode().name(),
            job.getStatus().name(),
            job.getOtpPrompt(),
            job.getCaptchaPrompt(),
            job.isCaptchaSolved(),
            job.getOfficialReferenceNumber(),
            job.getOfficialConfirmationText(),
            job.getSubmissionScreenshotPath(),
            job.getErrorMessage(),
            job.getWorkerId(),
            job.getWorkerHeartbeatAt(),
            job.getCreatedAt(),
            job.getUpdatedAt(),
            payload
        );
    }
}
