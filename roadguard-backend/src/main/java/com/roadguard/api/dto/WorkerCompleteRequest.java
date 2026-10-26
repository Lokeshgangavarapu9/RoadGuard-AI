package com.roadguard.api.dto;

public record WorkerCompleteRequest(
    String workerId,
    String officialReferenceNumber,
    String officialConfirmationText,
    String submissionScreenshotPath,
    String status // COMPLETED or FAILED
) {}
