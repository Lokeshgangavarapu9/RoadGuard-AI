package com.roadguard.api.dto;

import java.time.Instant;

public class SimulateSubmissionResponse {

    private String simulatedRefId;
    private String status;
    private Instant simulatedAt;
    private String warningWatermark;
    private String authorityDeptCode;
    private String authorityDeptName;
    private String grievancePortalUrl;
    private String receiptText;

    public String getSimulatedRefId() { return simulatedRefId; }
    public void setSimulatedRefId(String simulatedRefId) { this.simulatedRefId = simulatedRefId; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getSimulatedAt() { return simulatedAt; }
    public void setSimulatedAt(Instant simulatedAt) { this.simulatedAt = simulatedAt; }
    public String getWarningWatermark() { return warningWatermark; }
    public void setWarningWatermark(String warningWatermark) { this.warningWatermark = warningWatermark; }
    public String getAuthorityDeptCode() { return authorityDeptCode; }
    public void setAuthorityDeptCode(String authorityDeptCode) { this.authorityDeptCode = authorityDeptCode; }
    public String getAuthorityDeptName() { return authorityDeptName; }
    public void setAuthorityDeptName(String authorityDeptName) { this.authorityDeptName = authorityDeptName; }
    public String getGrievancePortalUrl() { return grievancePortalUrl; }
    public void setGrievancePortalUrl(String grievancePortalUrl) { this.grievancePortalUrl = grievancePortalUrl; }
    public String getReceiptText() { return receiptText; }
    public void setReceiptText(String receiptText) { this.receiptText = receiptText; }
}
