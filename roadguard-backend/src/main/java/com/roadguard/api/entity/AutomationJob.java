package com.roadguard.api.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "automation_jobs")
public class AutomationJob {

    public enum AutomationMode {
        MOCK,
        LIVE
    }

    public enum JobStatus {
        PENDING,
        DISPATCHED,
        RUNNING,
        AWAITING_OTP,
        AWAITING_CAPTCHA,
        SUBMITTED,
        COMPLETED,
        FAILED,
        CANCELLED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 36)
    private String uuid;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "complaint_id", nullable = false)
    private Complaint complaint;

    @Column(name = "portal_id", nullable = false, length = 50)
    private String portalId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AutomationMode mode = AutomationMode.MOCK;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private JobStatus status = JobStatus.PENDING;

    @Column(name = "otp_prompt", length = 500)
    private String otpPrompt;

    @Column(name = "otp_code", length = 20)
    private String otpCode;

    @Column(name = "captcha_prompt", length = 500)
    private String captchaPrompt;

    @Column(name = "captcha_solved", nullable = false)
    private boolean captchaSolved = false;

    @Column(name = "official_reference_number", length = 100)
    private String officialReferenceNumber;

    @Column(name = "official_confirmation_text", length = 2000)
    private String officialConfirmationText;

    @Column(name = "submission_screenshot_path", length = 500)
    private String submissionScreenshotPath;

    @Column(name = "error_message", length = 1000)
    private String errorMessage;

    @Column(name = "worker_id", length = 100)
    private String workerId;

    @Column(name = "worker_heartbeat_at")
    private Instant workerHeartbeatAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = Instant.now();
    }

    // Getters and setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public Complaint getComplaint() { return complaint; }
    public void setComplaint(Complaint complaint) { this.complaint = complaint; }

    public String getPortalId() { return portalId; }
    public void setPortalId(String portalId) { this.portalId = portalId; }

    public AutomationMode getMode() { return mode; }
    public void setMode(AutomationMode mode) { this.mode = mode; }

    public JobStatus getStatus() { return status; }
    public void setStatus(JobStatus status) { this.status = status; }

    public String getOtpPrompt() { return otpPrompt; }
    public void setOtpPrompt(String otpPrompt) { this.otpPrompt = otpPrompt; }

    public String getOtpCode() { return otpCode; }
    public void setOtpCode(String otpCode) { this.otpCode = otpCode; }

    public String getCaptchaPrompt() { return captchaPrompt; }
    public void setCaptchaPrompt(String captchaPrompt) { this.captchaPrompt = captchaPrompt; }

    public boolean isCaptchaSolved() { return captchaSolved; }
    public void setCaptchaSolved(boolean captchaSolved) { this.captchaSolved = captchaSolved; }

    public String getOfficialReferenceNumber() { return officialReferenceNumber; }
    public void setOfficialReferenceNumber(String officialReferenceNumber) { this.officialReferenceNumber = officialReferenceNumber; }

    public String getOfficialConfirmationText() { return officialConfirmationText; }
    public void setOfficialConfirmationText(String officialConfirmationText) { this.officialConfirmationText = officialConfirmationText; }

    public String getSubmissionScreenshotPath() { return submissionScreenshotPath; }
    public void setSubmissionScreenshotPath(String submissionScreenshotPath) { this.submissionScreenshotPath = submissionScreenshotPath; }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }

    public String getWorkerId() { return workerId; }
    public void setWorkerId(String workerId) { this.workerId = workerId; }

    public Instant getWorkerHeartbeatAt() { return workerHeartbeatAt; }
    public void setWorkerHeartbeatAt(Instant workerHeartbeatAt) { this.workerHeartbeatAt = workerHeartbeatAt; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
