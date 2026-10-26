package com.roadguard.api.dto;

public record WorkerEventRequest(
    String workerId,
    String action,
    String result,
    String details,
    String screenshotPath,
    String otpPrompt,
    String captchaPrompt
) {}
