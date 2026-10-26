package com.roadguard.api.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "filing_audit_logs")
public class FilingAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "job_id")
    private AutomationJob job;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "complaint_id", nullable = false)
    private Complaint complaint;

    @Column(name = "portal_name", nullable = false, length = 100)
    private String portalName;

    @Column(nullable = false, length = 100)
    private String action;

    @Column(nullable = false, length = 50)
    private String result = "SUCCESS";

    @Column(length = 2000)
    private String details;

    @Column(name = "screenshot_path", length = 500)
    private String screenshotPath;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public FilingAuditLog() {}

    public FilingAuditLog(AutomationJob job, Complaint complaint, String portalName, String action, String result, String details, String screenshotPath) {
        this.job = job;
        this.complaint = complaint;
        this.portalName = portalName;
        this.action = action;
        this.result = result;
        this.details = details;
        this.screenshotPath = screenshotPath;
        this.createdAt = Instant.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public AutomationJob getJob() { return job; }
    public void setJob(AutomationJob job) { this.job = job; }

    public Complaint getComplaint() { return complaint; }
    public void setComplaint(Complaint complaint) { this.complaint = complaint; }

    public String getPortalName() { return portalName; }
    public void setPortalName(String portalName) { this.portalName = portalName; }

    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }

    public String getResult() { return result; }
    public void setResult(String result) { this.result = result; }

    public String getDetails() { return details; }
    public void setDetails(String details) { this.details = details; }

    public String getScreenshotPath() { return screenshotPath; }
    public void setScreenshotPath(String screenshotPath) { this.screenshotPath = screenshotPath; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
