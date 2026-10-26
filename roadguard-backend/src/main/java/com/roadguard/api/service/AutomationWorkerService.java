package com.roadguard.api.service;

import com.roadguard.api.dto.AutomationJobDto;
import com.roadguard.api.dto.FilingAuditLogDto;
import com.roadguard.api.dto.WorkerCompleteRequest;
import com.roadguard.api.dto.WorkerEventRequest;
import com.roadguard.api.entity.AutomationJob;
import com.roadguard.api.entity.Complaint;
import com.roadguard.api.entity.FilingAuditLog;
import com.roadguard.api.entity.RoadIssue;
import com.roadguard.api.repository.AutomationJobRepository;
import com.roadguard.api.repository.ComplaintRepository;
import com.roadguard.api.repository.DetectionObservationRepository;
import com.roadguard.api.repository.FilingAuditLogRepository;
import com.roadguard.api.repository.RoadIssueRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
@SuppressWarnings("null")
public class AutomationWorkerService {

    private static final Logger log = LoggerFactory.getLogger(AutomationWorkerService.class);

    private final AutomationJobRepository jobRepository;
    private final ComplaintRepository complaintRepository;
    private final RoadIssueRepository roadIssueRepository;
    private final DetectionObservationRepository detectionObservationRepository;
    private final FilingAuditLogRepository auditLogRepository;
    private final com.roadguard.api.repository.UserProfileRepository userProfileRepository;

    // Ephemeral in-memory tracker for connected workers
    private final Map<String, Instant> workerHeartbeats = new ConcurrentHashMap<>();

    public AutomationWorkerService(
        AutomationJobRepository jobRepository,
        ComplaintRepository complaintRepository,
        RoadIssueRepository roadIssueRepository,
        DetectionObservationRepository detectionObservationRepository,
        FilingAuditLogRepository auditLogRepository,
        com.roadguard.api.repository.UserProfileRepository userProfileRepository
    ) {
        this.jobRepository = jobRepository;
        this.complaintRepository = complaintRepository;
        this.roadIssueRepository = roadIssueRepository;
        this.detectionObservationRepository = detectionObservationRepository;
        this.auditLogRepository = auditLogRepository;
        this.userProfileRepository = userProfileRepository;
    }

    /**
     * Creates or dispatches an automation filing job for a citizen-approved complaint.
     */
    @Transactional
    public AutomationJobDto dispatchFilingJob(Long complaintId, String portalId, AutomationJob.AutomationMode mode) {
        Complaint complaint = complaintRepository.findById(complaintId)
            .orElseThrow(() -> new IllegalArgumentException("Complaint not found: " + complaintId));

        // State Machine Transition: AwaitingCitizenApproval / ReadyToSubmit -> Submitting
        complaint.setStatus(Complaint.ComplaintStatus.SUBMITTING);
        complaintRepository.save(complaint);

        // Cancel previous active jobs for this complaint if any
        List<AutomationJob> existing = jobRepository.findByComplaintIdOrderByCreatedAtDesc(complaintId);
        for (AutomationJob j : existing) {
            if (j.getStatus() == AutomationJob.JobStatus.PENDING ||
                j.getStatus() == AutomationJob.JobStatus.DISPATCHED ||
                j.getStatus() == AutomationJob.JobStatus.RUNNING ||
                j.getStatus() == AutomationJob.JobStatus.AWAITING_OTP ||
                j.getStatus() == AutomationJob.JobStatus.AWAITING_CAPTCHA) {
                j.setStatus(AutomationJob.JobStatus.CANCELLED);
                jobRepository.save(j);
            }
        }

        AutomationJob job = new AutomationJob();
        job.setUuid(UUID.randomUUID().toString());
        job.setComplaint(complaint);
        job.setPortalId(portalId != null && !portalId.isBlank() ? portalId : "MOCK_PORTAL");
        job.setMode(mode != null ? mode : AutomationJob.AutomationMode.MOCK);
        job.setStatus(AutomationJob.JobStatus.PENDING);

        AutomationJob saved = jobRepository.save(job);

        // Initial Audit Log entry
        FilingAuditLog initialAudit = new FilingAuditLog(
            saved,
            complaint,
            saved.getPortalId(),
            "DISPATCH_JOB",
            "SUCCESS",
            "Filing job dispatched for Playwright automation worker (Mode: " + saved.getMode() + ")",
            null
        );
        auditLogRepository.save(initialAudit);

        log.info("Dispatched automation job #{} for complaint #{} in mode: {}", saved.getId(), complaint.getId(), saved.getMode());

        return toDto(saved);
    }

    /**
     * Worker polls for pending jobs.
     */
    @org.springframework.beans.factory.annotation.Value("${roadguard.automation.worker-secret:}")
    private String configuredWorkerSecret;

    @org.springframework.beans.factory.annotation.Value("${roadguard.automation.lease-timeout-seconds:180}")
    private long leaseTimeoutSeconds;

    /**
     * Validates worker secret token if configured.
     */
    public void validateWorkerSecret(String headerSecret) {
        if (configuredWorkerSecret != null && !configuredWorkerSecret.isBlank()) {
            if (headerSecret == null || !configuredWorkerSecret.equals(headerSecret.trim())) {
                throw new org.springframework.security.access.AccessDeniedException("Unauthorized worker access: invalid worker secret token.");
            }
        }
    }

    /**
     * Recovers abandoned or crashed jobs whose heartbeat expired beyond lease timeout.
     */
    @Transactional
    public void recoverAbandonedJobs() {
        Instant leaseCutoff = Instant.now().minus(Duration.ofSeconds(leaseTimeoutSeconds));
        List<AutomationJob> activeJobs = jobRepository.findAll().stream()
            .filter(j -> j.getStatus() == AutomationJob.JobStatus.RUNNING ||
                         j.getStatus() == AutomationJob.JobStatus.AWAITING_OTP ||
                         j.getStatus() == AutomationJob.JobStatus.AWAITING_CAPTCHA)
            .collect(Collectors.toList());

        for (AutomationJob j : activeJobs) {
            Instant lastBeat = j.getWorkerHeartbeatAt() != null ? j.getWorkerHeartbeatAt() : j.getUpdatedAt();
            if (lastBeat != null && lastBeat.isBefore(leaseCutoff)) {
                log.warn("Job #{} lease expired (last heartbeat: {}). Marking abandoned / recovering to PENDING.", j.getId(), lastBeat);
                j.setStatus(AutomationJob.JobStatus.PENDING);
                j.setWorkerId(null);
                jobRepository.save(j);

                FilingAuditLog audit = new FilingAuditLog(
                    j,
                    j.getComplaint(),
                    j.getPortalId(),
                    "LEASE_EXPIRED_RECOVERED",
                    "DIAGNOSTIC",
                    "Automation worker heartbeat timed out. Job reset to PENDING for safe recovery.",
                    null
                );
                auditLogRepository.save(audit);
            }
        }
    }

    /**
     * Worker polls for pending jobs (automatically runs lease recovery first).
     */
    @Transactional
    public List<AutomationJobDto> getPendingJobs() {
        recoverAbandonedJobs();
        return jobRepository.findByStatusOrderByCreatedAtAsc(AutomationJob.JobStatus.PENDING).stream()
            .map(this::toDto)
            .collect(Collectors.toList());
    }

    /**
     * Worker claims a pending job with concurrency locking.
     */
    @Transactional
    public synchronized AutomationJobDto claimJob(Long jobId, String workerId) {
        AutomationJob job = jobRepository.findById(jobId)
            .orElseThrow(() -> new IllegalArgumentException("Job not found: " + jobId));

        if (job.getStatus() != AutomationJob.JobStatus.PENDING) {
            throw new IllegalStateException("Job #" + jobId + " is not PENDING (current status: " + job.getStatus() + "). Already claimed or processed.");
        }

        job.setStatus(AutomationJob.JobStatus.RUNNING);
        job.setWorkerId(workerId);
        job.setWorkerHeartbeatAt(Instant.now());
        AutomationJob saved = jobRepository.save(job);

        recordHeartbeat(workerId);

        FilingAuditLog audit = new FilingAuditLog(
            saved,
            saved.getComplaint(),
            saved.getPortalId(),
            "WORKER_CLAIMED",
            "SUCCESS",
            "Job claimed by local Playwright worker: " + workerId,
            null
        );
        auditLogRepository.save(audit);

        return toDto(saved);
    }

    /**
     * Worker reports an audit event / state progression.
     */
    @Transactional
    public AutomationJobDto recordWorkerEvent(Long jobId, WorkerEventRequest req) {
        AutomationJob job = jobRepository.findById(jobId)
            .orElseThrow(() -> new IllegalArgumentException("Job not found: " + jobId));

        if (req.workerId() != null) {
            recordHeartbeat(req.workerId());
            job.setWorkerId(req.workerId());
            job.setWorkerHeartbeatAt(Instant.now());
        }

        Complaint complaint = job.getComplaint();

        // Update Job Status based on event
        if ("REQUEST_OTP".equalsIgnoreCase(req.action())) {
            job.setStatus(AutomationJob.JobStatus.AWAITING_OTP);
            job.setOtpPrompt(req.otpPrompt() != null ? req.otpPrompt() : "Government OTP required. Enter the OTP received on your registered mobile.");
            if (complaint != null) {
                complaint.setStatus(Complaint.ComplaintStatus.AWAITING_CITIZEN);
                complaintRepository.save(complaint);
            }
        } else if ("REQUEST_CAPTCHA".equalsIgnoreCase(req.action())) {
            job.setStatus(AutomationJob.JobStatus.AWAITING_CAPTCHA);
            job.setCaptchaPrompt(req.captchaPrompt() != null ? req.captchaPrompt() : "Government CAPTCHA required. Complete the CAPTCHA in the browser.");
            if (complaint != null) {
                complaint.setStatus(Complaint.ComplaintStatus.AWAITING_CITIZEN);
                complaintRepository.save(complaint);
            }
        } else if ("PORTAL_CHANGED".equalsIgnoreCase(req.action()) || "ERROR".equalsIgnoreCase(req.action())) {
            job.setStatus(AutomationJob.JobStatus.FAILED);
            job.setErrorMessage(req.details());
            if (complaint != null) {
                complaint.setStatus(Complaint.ComplaintStatus.FAILED);
                complaintRepository.save(complaint);
            }
        } else if ("FORM_FILLED".equalsIgnoreCase(req.action()) || "AUTH_SUCCESS".equalsIgnoreCase(req.action())) {
            job.setStatus(AutomationJob.JobStatus.RUNNING);
            if (complaint != null) {
                complaint.setStatus(Complaint.ComplaintStatus.SUBMITTING);
                complaintRepository.save(complaint);
            }
        }

        AutomationJob saved = jobRepository.save(job);

        // Record Audit Trail
        FilingAuditLog audit = new FilingAuditLog(
            saved,
            complaint,
            saved.getPortalId(),
            req.action() != null ? req.action() : "EVENT",
            req.result() != null ? req.result() : "SUCCESS",
            req.details(),
            req.screenshotPath()
        );
        auditLogRepository.save(audit);

        log.info("Job #{} recorded event '{}' with result '{}'", saved.getId(), req.action(), req.result());

        return toDto(saved);
    }

    /**
     * Citizen provides the received SMS OTP.
     */
    @Transactional
    public AutomationJobDto supplyOtp(Long jobId, String otpCode) {
        if (otpCode == null || otpCode.trim().isEmpty()) {
            throw new IllegalArgumentException("OTP code cannot be blank.");
        }

        AutomationJob job = jobRepository.findById(jobId)
            .orElseThrow(() -> new IllegalArgumentException("Job not found: " + jobId));

        job.setOtpCode(otpCode.trim());
        // Switch status back to RUNNING so worker picks up OTP
        job.setStatus(AutomationJob.JobStatus.RUNNING);
        AutomationJob saved = jobRepository.save(job);

        Complaint complaint = job.getComplaint();
        if (complaint != null) {
            complaint.setStatus(Complaint.ComplaintStatus.SUBMITTING);
            complaintRepository.save(complaint);
        }

        FilingAuditLog audit = new FilingAuditLog(
            saved,
            complaint,
            saved.getPortalId(),
            "SUPPLY_OTP",
            "SUCCESS",
            "Citizen entered mobile OTP into RoadGuard. Resuming Playwright automation.",
            null
        );
        auditLogRepository.save(audit);

        log.info("Job #{} received OTP from citizen. Resuming automation.", jobId);

        return toDto(saved);
    }

    /**
     * Citizen confirms completion of browser CAPTCHA challenge.
     */
    @Transactional
    public AutomationJobDto confirmCaptchaSolved(Long jobId) {
        AutomationJob job = jobRepository.findById(jobId)
            .orElseThrow(() -> new IllegalArgumentException("Job not found: " + jobId));

        job.setCaptchaSolved(true);
        job.setStatus(AutomationJob.JobStatus.RUNNING);
        AutomationJob saved = jobRepository.save(job);

        Complaint complaint = job.getComplaint();
        if (complaint != null) {
            complaint.setStatus(Complaint.ComplaintStatus.SUBMITTING);
            complaintRepository.save(complaint);
        }

        FilingAuditLog audit = new FilingAuditLog(
            saved,
            complaint,
            saved.getPortalId(),
            "CAPTCHA_SOLVED",
            "SUCCESS",
            "Citizen completed CAPTCHA in browser. Resuming Playwright automation.",
            null
        );
        auditLogRepository.save(audit);

        log.info("Job #{} confirmed CAPTCHA solved by citizen. Resuming automation.", jobId);

        return toDto(saved);
    }

    /**
     * Worker completes the filing job with verified official government receipt.
     */
    @Transactional
    public AutomationJobDto completeJob(Long jobId, WorkerCompleteRequest req) {
        AutomationJob job = jobRepository.findById(jobId)
            .orElseThrow(() -> new IllegalArgumentException("Job not found: " + jobId));

        String refNum = req.officialReferenceNumber() != null ? req.officialReferenceNumber().trim() : null;

        if ("COMPLETED".equalsIgnoreCase(req.status())) {
            if (refNum == null || refNum.isEmpty()) {
                throw new IllegalArgumentException("Cannot complete job without verified official reference number.");
            }

            job.setStatus(AutomationJob.JobStatus.COMPLETED);
            job.setOfficialReferenceNumber(refNum);
            job.setOfficialConfirmationText(req.officialConfirmationText());
            job.setSubmissionScreenshotPath(req.submissionScreenshotPath());

            Complaint complaint = job.getComplaint();
            if (complaint != null) {
                complaint.setStatus(Complaint.ComplaintStatus.SUBMITTED);
                complaint.setOfficialRefId(refNum);
                complaint.setSubmittedAt(Instant.now());
                complaint.setSubmissionNotes(req.officialConfirmationText() != null ? req.officialConfirmationText() : "Verified official government portal confirmation.");
                complaintRepository.save(complaint);

                RoadIssue issue = complaint.getRoadIssue();
                if (issue != null) {
                    issue.setStatus(RoadIssue.IssueStatus.COMPLAINT_SUBMITTED);
                    roadIssueRepository.save(issue);
                }
            }

            FilingAuditLog audit = new FilingAuditLog(
                job,
                complaint,
                job.getPortalId(),
                "EXTRACT_REFERENCE",
                "SUCCESS",
                "Official government reference extracted: " + refNum,
                req.submissionScreenshotPath()
            );
            auditLogRepository.save(audit);

            log.info("Job #{} successfully completed with official reference: {}", jobId, refNum);
        } else if ("SUBMISSION_UNVERIFIED".equalsIgnoreCase(req.status())) {
            job.setStatus(AutomationJob.JobStatus.FAILED);
            job.setErrorMessage("Submission outcome uncertain: " + (req.officialConfirmationText() != null ? req.officialConfirmationText() : "Official receipt not detected. Preserving unverified state."));

            Complaint complaint = job.getComplaint();
            if (complaint != null) {
                complaint.setStatus(Complaint.ComplaintStatus.SUBMISSION_UNVERIFIED);
                complaintRepository.save(complaint);
            }

            FilingAuditLog audit = new FilingAuditLog(
                job,
                complaint,
                job.getPortalId(),
                "SUBMISSION_UNVERIFIED",
                "DIAGNOSTIC",
                "Form was submitted, but official government confirmation was not received or ambiguous. Marked SUBMISSION_UNVERIFIED to prevent duplicate submission.",
                req.submissionScreenshotPath()
            );
            auditLogRepository.save(audit);
            log.warn("Job #{} marked SUBMISSION_UNVERIFIED: {}", jobId, job.getErrorMessage());
        } else {
            job.setStatus(AutomationJob.JobStatus.FAILED);
            job.setErrorMessage(req.officialConfirmationText() != null ? req.officialConfirmationText() : "Portal submission failed.");

            Complaint complaint = job.getComplaint();
            if (complaint != null) {
                complaint.setStatus(Complaint.ComplaintStatus.FAILED);
                complaintRepository.save(complaint);
            }

            FilingAuditLog audit = new FilingAuditLog(
                job,
                complaint,
                job.getPortalId(),
                "SUBMISSION_FAILED",
                "FAILED",
                job.getErrorMessage(),
                req.submissionScreenshotPath()
            );
            auditLogRepository.save(audit);
        }

        // Ephemeral wipe of OTP code
        job.setOtpCode(null);

        AutomationJob saved = jobRepository.save(job);
        return toDto(saved);
    }

    @Transactional(readOnly = true)
    public AutomationJobDto getJob(Long jobId) {
        AutomationJob job = jobRepository.findById(jobId)
            .orElseThrow(() -> new IllegalArgumentException("Job not found: " + jobId));
        return toDto(job);
    }

    @Transactional(readOnly = true)
    public Optional<AutomationJobDto> getLatestJobForComplaint(Long complaintId) {
        return jobRepository.findFirstByComplaintIdOrderByCreatedAtDesc(complaintId)
            .map(this::toDto);
    }

    @Transactional(readOnly = true)
    public List<FilingAuditLogDto> getAuditLogsForComplaint(Long complaintId) {
        return auditLogRepository.findByComplaintIdOrderByCreatedAtAsc(complaintId).stream()
            .map(FilingAuditLogDto::fromEntity)
            .collect(Collectors.toList());
    }

    public void recordWorkerHeartbeat(String workerId) {
        recordHeartbeat(workerId);
    }

    public void recordHeartbeat(String workerId) {
        if (workerId != null && !workerId.isBlank()) {
            workerHeartbeats.put(workerId, Instant.now());
        }
    }

    public Map<String, Object> getWorkerStatus() {
        Instant threshold = Instant.now().minus(Duration.ofSeconds(15));
        List<String> activeWorkers = workerHeartbeats.entrySet().stream()
            .filter(e -> e.getValue().isAfter(threshold))
            .map(Map.Entry::getKey)
            .collect(Collectors.toList());

        boolean isConnected = !activeWorkers.isEmpty();
        return Map.of(
            "connected", isConnected,
            "activeWorkerCount", activeWorkers.size(),
            "activeWorkers", activeWorkers,
            "timestamp", Instant.now().toString()
        );
    }

    private AutomationJobDto toDto(AutomationJob job) {
        Complaint c = job.getComplaint();
        List<String> evidenceUrls = new ArrayList<>();
        if (c != null && c.getRoadIssue() != null) {
            List<com.roadguard.api.entity.DetectionObservation> obsList =
                detectionObservationRepository.findByRoadIssueId(c.getRoadIssue().getId());
            for (com.roadguard.api.entity.DetectionObservation obs : obsList) {
                if (obs.getFrame() != null && obs.getFrame().getStorageKey() != null) {
                    evidenceUrls.add(obs.getFrame().getStorageKey());
                }
            }
        }

        // Data minimization: Send only fields strictly required for the specific target portal workflow
        String vrn = null;
        String address = null;
        var profileOpt = userProfileRepository.findFirstByOrderByIdAsc();
        if (profileOpt.isPresent()) {
            var prof = profileOpt.get();
            String portal = job.getPortalId() != null ? job.getPortalId().toUpperCase() : "";
            if ("RAJMARGYATRA_NHAI".equals(portal)) {
                // National Highway: Defect location is GPS telemetry; residential address is omitted.
                // Vehicle registration is optional for vehicle damage claims only.
                vrn = prof.getPrimaryVrn();
                address = null;
            } else if ("AP_CDMA".equals(portal)) {
                // AP Urban Local Body: Needs municipal jurisdiction; vehicle registration is omitted.
                vrn = null;
                address = prof.getCityOrMunicipality() != null ? prof.getCityOrMunicipality() : prof.getUlbName();
            } else {
                // MOCK_PORTAL or other: No extraneous personal data sent
                vrn = null;
                address = null;
            }
        }

        return AutomationJobDto.fromEntity(job, evidenceUrls, vrn, address);
    }
}
