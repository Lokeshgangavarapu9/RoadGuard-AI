package com.roadguard.api.controller;

import com.roadguard.api.dto.AutomationJobDto;
import com.roadguard.api.dto.FilingAuditLogDto;
import com.roadguard.api.dto.ProvideOtpRequest;
import com.roadguard.api.dto.WorkerCompleteRequest;
import com.roadguard.api.dto.WorkerEventRequest;
import com.roadguard.api.entity.AutomationJob;
import com.roadguard.api.service.AutomationWorkerService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/automation")
@SuppressWarnings("null")
public class AutomationWorkerController {

    private final AutomationWorkerService workerService;

    public AutomationWorkerController(AutomationWorkerService workerService) {
        this.workerService = workerService;
    }

    /**
     * Check if local Playwright automation agent is connected and online.
     */
    @GetMapping("/worker/status")
    public ResponseEntity<Map<String, Object>> getWorkerStatus() {
        return ResponseEntity.ok(workerService.getWorkerStatus());
    }

    /**
     * Worker heartbeat endpoint.
     */
    @PostMapping("/worker/heartbeat")
    public ResponseEntity<Map<String, String>> workerHeartbeat(@RequestParam String workerId) {
        workerService.recordWorkerHeartbeat(workerId);
        return ResponseEntity.ok(Map.of("status", "OK", "workerId", workerId));
    }

    /**
     * Citizen approves & dispatches complaint filing to automation worker.
     */
    @PostMapping("/complaints/{complaintId}/dispatch")
    public ResponseEntity<AutomationJobDto> dispatchFilingJob(
        @PathVariable Long complaintId,
        @RequestParam(defaultValue = "MOCK") String mode,
        @RequestParam(required = false) String portalId
    ) {
        AutomationJob.AutomationMode automationMode = AutomationJob.AutomationMode.valueOf(mode.toUpperCase());
        AutomationJobDto job = workerService.dispatchFilingJob(complaintId, portalId, automationMode);
        return ResponseEntity.status(HttpStatus.CREATED).body(job);
    }

    /**
     * Retrieve the active or most recent job for a complaint.
     */
    @GetMapping("/complaints/{complaintId}/job")
    public ResponseEntity<AutomationJobDto> getJobForComplaint(@PathVariable Long complaintId) {
        return workerService.getLatestJobForComplaint(complaintId)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.noContent().build());
    }

    /**
     * Retrieve the real filing audit trail for a complaint.
     */
    @GetMapping("/complaints/{complaintId}/audit")
    public ResponseEntity<List<FilingAuditLogDto>> getAuditTrail(@PathVariable Long complaintId) {
        List<FilingAuditLogDto> logs = workerService.getAuditLogsForComplaint(complaintId);
        return ResponseEntity.ok(logs);
    }

    /**
     * Worker polls for pending jobs.
     */
    @GetMapping("/jobs/pending")
    public ResponseEntity<List<AutomationJobDto>> getPendingJobs(
        @RequestHeader(value = "X-Worker-Secret", required = false) String workerSecret
    ) {
        workerService.validateWorkerSecret(workerSecret);
        return ResponseEntity.ok(workerService.getPendingJobs());
    }

    /**
     * Worker claims a pending job.
     */
    @PostMapping("/jobs/{jobId}/claim")
    public ResponseEntity<AutomationJobDto> claimJob(
        @PathVariable Long jobId,
        @RequestParam String workerId,
        @RequestHeader(value = "X-Worker-Secret", required = false) String workerSecret
    ) {
        workerService.validateWorkerSecret(workerSecret);
        AutomationJobDto claimed = workerService.claimJob(jobId, workerId);
        return ResponseEntity.ok(claimed);
    }

    /**
     * Worker reports state milestone or event (e.g. OTP_REQUIRED, CAPTCHA_REQUIRED).
     */
    @PostMapping("/jobs/{jobId}/event")
    public ResponseEntity<AutomationJobDto> reportEvent(
        @PathVariable Long jobId,
        @RequestBody WorkerEventRequest req,
        @RequestHeader(value = "X-Worker-Secret", required = false) String workerSecret
    ) {
        workerService.validateWorkerSecret(workerSecret);
        AutomationJobDto updated = workerService.recordWorkerEvent(jobId, req);
        return ResponseEntity.ok(updated);
    }

    /**
     * Citizen enters the received mobile OTP into RoadGuard.
     */
    @PostMapping("/jobs/{jobId}/otp")
    public ResponseEntity<AutomationJobDto> supplyOtp(
        @PathVariable Long jobId,
        @RequestBody ProvideOtpRequest req
    ) {
        AutomationJobDto updated = workerService.supplyOtp(jobId, req.otpCode());
        return ResponseEntity.ok(updated);
    }

    /**
     * Citizen confirms they completed the browser CAPTCHA challenge.
     */
    @PostMapping("/jobs/{jobId}/captcha-solved")
    public ResponseEntity<AutomationJobDto> confirmCaptchaSolved(@PathVariable Long jobId) {
        AutomationJobDto updated = workerService.confirmCaptchaSolved(jobId);
        return ResponseEntity.ok(updated);
    }

    /**
     * Worker reports completion with verified official government receipt.
     */
    @PostMapping("/jobs/{jobId}/complete")
    public ResponseEntity<AutomationJobDto> completeJob(
        @PathVariable Long jobId,
        @RequestBody WorkerCompleteRequest req,
        @RequestHeader(value = "X-Worker-Secret", required = false) String workerSecret
    ) {
        workerService.validateWorkerSecret(workerSecret);
        AutomationJobDto completed = workerService.completeJob(jobId, req);
        return ResponseEntity.ok(completed);
    }

    /**
     * Get single job by ID.
     */
    @GetMapping("/jobs/{jobId}")
    public ResponseEntity<AutomationJobDto> getJob(@PathVariable Long jobId) {
        return ResponseEntity.ok(workerService.getJob(jobId));
    }
}
