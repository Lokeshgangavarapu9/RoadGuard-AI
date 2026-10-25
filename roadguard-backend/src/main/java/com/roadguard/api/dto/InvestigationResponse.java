package com.roadguard.api.dto;

import com.roadguard.api.entity.InvestigationResult;
import java.time.Instant;
import java.time.LocalDate;

public class InvestigationResponse {

    private Long id;
    private Long roadIssueId;
    private String roadIssueUuid;
    private Long candidateAuthorityId;
    private String candidateAuthorityCode;
    private String candidateAuthorityName;
    private String candidateAuthorityJurisdiction;
    private String portalUrl;
    private String grievanceUrl;
    private String helpline;
    private String authorityReason;
    private InvestigationResult.AuthorityConfidence authorityConfidence;
    private Boolean dlpApplicable;
    private LocalDate dlpEndDate;
    private Long dlpContractorId;
    private String contractorName;
    private String tenderId;
    private Integer evidenceTier;
    private String evidenceSummary;
    private String missingInformation;
    private InvestigationResult.InvestigatedBy investigatedBy;
    private Instant investigatedAt;
    private String investigationNotes;

    public static InvestigationResponse fromEntity(InvestigationResult ir) {
        InvestigationResponse r = new InvestigationResponse();
        r.setId(ir.getId());
        r.setRoadIssueId(ir.getRoadIssue().getId());
        r.setRoadIssueUuid(ir.getRoadIssue().getUuid());
        if (ir.getCandidateAuthority() != null) {
            r.setCandidateAuthorityId(ir.getCandidateAuthority().getId());
            r.setCandidateAuthorityCode(ir.getCandidateAuthority().getDeptCode());
            r.setCandidateAuthorityName(ir.getCandidateAuthority().getDeptName());
            r.setCandidateAuthorityJurisdiction(ir.getCandidateAuthority().getJurisdiction());
            r.setPortalUrl(ir.getCandidateAuthority().getPortalUrl());
            r.setGrievanceUrl(ir.getCandidateAuthority().getGrievanceUrl());
            r.setHelpline(ir.getCandidateAuthority().getHelpline());
        }
        r.setAuthorityReason(ir.getAuthorityReason());
        r.setAuthorityConfidence(ir.getAuthorityConfidence());
        r.setDlpApplicable(ir.getDlpApplicable());
        r.setDlpEndDate(ir.getDlpEndDate());
        if (ir.getDlpContractor() != null) {
            r.setDlpContractorId(ir.getDlpContractor().getId());
            r.setContractorName(ir.getDlpContractor().getContractorName());
            r.setTenderId(ir.getDlpContractor().getTenderId());
        }
        r.setEvidenceTier(ir.getEvidenceTier());
        r.setEvidenceSummary(ir.getEvidenceSummary());
        r.setMissingInformation(ir.getMissingInformation());
        r.setInvestigatedBy(ir.getInvestigatedBy());
        r.setInvestigatedAt(ir.getInvestigatedAt());
        r.setInvestigationNotes(ir.getInvestigationNotes());
        return r;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getRoadIssueId() { return roadIssueId; }
    public void setRoadIssueId(Long roadIssueId) { this.roadIssueId = roadIssueId; }
    public String getRoadIssueUuid() { return roadIssueUuid; }
    public void setRoadIssueUuid(String roadIssueUuid) { this.roadIssueUuid = roadIssueUuid; }
    public Long getCandidateAuthorityId() { return candidateAuthorityId; }
    public void setCandidateAuthorityId(Long candidateAuthorityId) { this.candidateAuthorityId = candidateAuthorityId; }
    public String getCandidateAuthorityCode() { return candidateAuthorityCode; }
    public void setCandidateAuthorityCode(String candidateAuthorityCode) { this.candidateAuthorityCode = candidateAuthorityCode; }
    public String getCandidateAuthorityName() { return candidateAuthorityName; }
    public void setCandidateAuthorityName(String candidateAuthorityName) { this.candidateAuthorityName = candidateAuthorityName; }
    public String getCandidateAuthorityJurisdiction() { return candidateAuthorityJurisdiction; }
    public void setCandidateAuthorityJurisdiction(String candidateAuthorityJurisdiction) { this.candidateAuthorityJurisdiction = candidateAuthorityJurisdiction; }
    public String getPortalUrl() { return portalUrl; }
    public void setPortalUrl(String portalUrl) { this.portalUrl = portalUrl; }
    public String getGrievanceUrl() { return grievanceUrl; }
    public void setGrievanceUrl(String grievanceUrl) { this.grievanceUrl = grievanceUrl; }
    public String getHelpline() { return helpline; }
    public void setHelpline(String helpline) { this.helpline = helpline; }
    public String getAuthorityReason() { return authorityReason; }
    public void setAuthorityReason(String authorityReason) { this.authorityReason = authorityReason; }
    public InvestigationResult.AuthorityConfidence getAuthorityConfidence() { return authorityConfidence; }
    public void setAuthorityConfidence(InvestigationResult.AuthorityConfidence authorityConfidence) { this.authorityConfidence = authorityConfidence; }
    public Boolean getDlpApplicable() { return dlpApplicable; }
    public void setDlpApplicable(Boolean dlpApplicable) { this.dlpApplicable = dlpApplicable; }
    public LocalDate getDlpEndDate() { return dlpEndDate; }
    public void setDlpEndDate(LocalDate dlpEndDate) { this.dlpEndDate = dlpEndDate; }
    public Long getDlpContractorId() { return dlpContractorId; }
    public void setDlpContractorId(Long dlpContractorId) { this.dlpContractorId = dlpContractorId; }
    public String getContractorName() { return contractorName; }
    public void setContractorName(String contractorName) { this.contractorName = contractorName; }
    public String getTenderId() { return tenderId; }
    public void setTenderId(String tenderId) { this.tenderId = tenderId; }
    public Integer getEvidenceTier() { return evidenceTier; }
    public void setEvidenceTier(Integer evidenceTier) { this.evidenceTier = evidenceTier; }
    public String getEvidenceSummary() { return evidenceSummary; }
    public void setEvidenceSummary(String evidenceSummary) { this.evidenceSummary = evidenceSummary; }
    public String getMissingInformation() { return missingInformation; }
    public void setMissingInformation(String missingInformation) { this.missingInformation = missingInformation; }
    public InvestigationResult.InvestigatedBy getInvestigatedBy() { return investigatedBy; }
    public void setInvestigatedBy(InvestigationResult.InvestigatedBy investigatedBy) { this.investigatedBy = investigatedBy; }
    public Instant getInvestigatedAt() { return investigatedAt; }
    public void setInvestigatedAt(Instant investigatedAt) { this.investigatedAt = investigatedAt; }
    public String getInvestigationNotes() { return investigationNotes; }
    public void setInvestigationNotes(String investigationNotes) { this.investigationNotes = investigationNotes; }
}
