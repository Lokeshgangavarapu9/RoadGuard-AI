package com.roadguard.api.dto;

import com.roadguard.api.entity.Complaint;
import java.time.Instant;

public class ComplaintResponse {

    private Long id;
    private String uuid;
    private Long roadIssueId;
    private String roadIssueUuid;
    private Long authorityId;
    private String authorityDeptCode;
    private String authorityDeptName;
    private String subject;
    private String bodyText;
    private String complainantName;
    private String complainantEmail;
    private String complainantPhone;
    private Complaint.ComplaintStatus status;
    private String submissionStage;
    private String simulatedRefId;
    private Instant simulatedAt;
    private String simulatedWarning;
    private String officialRefId;
    private Instant submittedAt;
    private String officialPortalUrl;
    private String idempotencyKey;
    private Instant createdAt;
    private Instant approvedAt;
    private Instant updatedAt;

    public static ComplaintResponse fromEntity(Complaint c) {
        ComplaintResponse r = new ComplaintResponse();
        r.setId(c.getId());
        r.setUuid(c.getUuid());
        r.setRoadIssueId(c.getRoadIssue().getId());
        r.setRoadIssueUuid(c.getRoadIssue().getUuid());
        if (c.getAuthority() != null) {
            r.setAuthorityId(c.getAuthority().getId());
            r.setAuthorityDeptCode(c.getAuthority().getDeptCode());
            r.setAuthorityDeptName(c.getAuthority().getDeptName());
        }
        r.setSubject(c.getSubject());
        r.setBodyText(c.getBodyText());
        r.setComplainantName(c.getComplainantName());
        r.setComplainantEmail(c.getComplainantEmail());
        r.setComplainantPhone(c.getComplainantPhone());
        r.setStatus(c.getStatus());
        r.setSubmissionStage(c.getSubmissionStage());
        r.setSimulatedRefId(c.getSimulatedRefId());
        r.setSimulatedAt(c.getSimulatedAt());
        r.setSimulatedWarning(c.getSimulatedWarning());
        r.setOfficialRefId(c.getOfficialRefId());
        r.setSubmittedAt(c.getSubmittedAt());
        r.setOfficialPortalUrl(c.getOfficialPortalUrl());
        r.setIdempotencyKey(c.getIdempotencyKey());
        r.setCreatedAt(c.getCreatedAt());
        r.setApprovedAt(c.getApprovedAt());
        r.setUpdatedAt(c.getUpdatedAt());
        return r;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }
    public Long getRoadIssueId() { return roadIssueId; }
    public void setRoadIssueId(Long roadIssueId) { this.roadIssueId = roadIssueId; }
    public String getRoadIssueUuid() { return roadIssueUuid; }
    public void setRoadIssueUuid(String roadIssueUuid) { this.roadIssueUuid = roadIssueUuid; }
    public Long getAuthorityId() { return authorityId; }
    public void setAuthorityId(Long authorityId) { this.authorityId = authorityId; }
    public String getAuthorityDeptCode() { return authorityDeptCode; }
    public void setAuthorityDeptCode(String authorityDeptCode) { this.authorityDeptCode = authorityDeptCode; }
    public String getAuthorityDeptName() { return authorityDeptName; }
    public void setAuthorityDeptName(String authorityDeptName) { this.authorityDeptName = authorityDeptName; }
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
    public Complaint.ComplaintStatus getStatus() { return status; }
    public void setStatus(Complaint.ComplaintStatus status) { this.status = status; }
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
    public String getOfficialPortalUrl() { return officialPortalUrl; }
    public void setOfficialPortalUrl(String officialPortalUrl) { this.officialPortalUrl = officialPortalUrl; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public void setIdempotencyKey(String idempotencyKey) { this.idempotencyKey = idempotencyKey; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getApprovedAt() { return approvedAt; }
    public void setApprovedAt(Instant approvedAt) { this.approvedAt = approvedAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
