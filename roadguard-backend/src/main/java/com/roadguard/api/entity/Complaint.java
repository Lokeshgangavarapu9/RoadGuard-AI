package com.roadguard.api.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "complaints")
public class Complaint {

    public enum ComplaintStatus {
        DRAFT,
        AWAITING_REVIEW,
        VERIFIED,
        COMPLAINT_PREPARED,
        AWAITING_USER_ACTION,
        SUBMISSION_IN_PROGRESS,
        SUBMITTED,
        SUBMISSION_FAILED,
        SUBMISSION_UNKNOWN,
        APPROVED,
        SIMULATED,
        FAILED,
        WITHDRAWN
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 36)
    private String uuid;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "road_issue_id", nullable = false)
    private RoadIssue roadIssue;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "authority_id")
    private AuthorityRecord authority;

    @Column(nullable = false, length = 500)
    private String subject;

    @Column(nullable = false, length = 10000)
    private String bodyText;

    @Column(length = 200)
    private String complainantName;

    @Column(length = 200)
    private String complainantEmail;

    @Column(length = 20)
    private String complainantPhone;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private ComplaintStatus status = ComplaintStatus.DRAFT;

    @Column(nullable = false, length = 10)
    private String submissionStage = "B";

    @Column(name = "idempotency_key", length = 100)
    private String idempotencyKey;

    @Column(name = "routing_evidence", length = 2000)
    private String routingEvidence;

    @Column(name = "official_portal_url", length = 500)
    private String officialPortalUrl;

    @Column(name = "submission_notes", length = 1000)
    private String submissionNotes;

    // Stage A simulated submission legacy fields (kept for migration backwards compatibility)
    @Column(length = 100)
    private String simulatedRefId;

    private Instant simulatedAt;

    @Column(length = 500)
    private String simulatedWarning;

    // Stage B+ real submission
    @Column(length = 200)
    private String officialRefId;

    private Instant submittedAt;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    private Instant approvedAt;

    @Column(nullable = false)
    private Instant updatedAt = Instant.now();

    @PreUpdate
    protected void onUpdate() { this.updatedAt = Instant.now(); }

    // ── Getters and setters ──
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }
    public RoadIssue getRoadIssue() { return roadIssue; }
    public void setRoadIssue(RoadIssue roadIssue) { this.roadIssue = roadIssue; }
    public AuthorityRecord getAuthority() { return authority; }
    public void setAuthority(AuthorityRecord authority) { this.authority = authority; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
    public String getBodyText() { return bodyText; }
    public void setBodyText(String bodyText) { this.bodyText = bodyText; }
    public String getComplainantName() { return complainantName; }
    public void setComplainantName(String complainantName) { this.complainantName = complainantName; }
    public String getComplainantEmail() { return complainantEmail; }
    public void setComplainantEmail(String complainantEmail) { this.complainantEmail = complainantEmail; }
    public String getComplainantPhone() { return complainantPhone; }
    public void setComplainantPhone(String complainantPhone) { this.complainantPhone = complainantPhone; }
    public ComplaintStatus getStatus() { return status; }
    public void setStatus(ComplaintStatus status) { this.status = status; }
    public String getSubmissionStage() { return submissionStage; }
    public void setSubmissionStage(String submissionStage) { this.submissionStage = submissionStage; }
    public String getSimulatedRefId() { return simulatedRefId; }
    public void setSimulatedRefId(String simulatedRefId) { this.simulatedRefId = simulatedRefId; }
    public Instant getSimulatedAt() { return simulatedAt; }
    public void setSimulatedAt(Instant simulatedAt) { this.simulatedAt = simulatedAt; }
    public String getSimulatedWarning() { return simulatedWarning; }
    public void setSimulatedWarning(String simulatedWarning) { this.simulatedWarning = simulatedWarning; }
    public String getOfficialRefId() { return officialRefId; }
    public void setOfficialRefId(String officialRefId) { this.officialRefId = officialRefId; }
    public Instant getSubmittedAt() { return submittedAt; }
    public void setSubmittedAt(Instant submittedAt) { this.submittedAt = submittedAt; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public void setIdempotencyKey(String idempotencyKey) { this.idempotencyKey = idempotencyKey; }
    public String getRoutingEvidence() { return routingEvidence; }
    public void setRoutingEvidence(String routingEvidence) { this.routingEvidence = routingEvidence; }
    public String getOfficialPortalUrl() { return officialPortalUrl; }
    public void setOfficialPortalUrl(String officialPortalUrl) { this.officialPortalUrl = officialPortalUrl; }
    public String getSubmissionNotes() { return submissionNotes; }
    public void setSubmissionNotes(String submissionNotes) { this.submissionNotes = submissionNotes; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getApprovedAt() { return approvedAt; }
    public void setApprovedAt(Instant approvedAt) { this.approvedAt = approvedAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
