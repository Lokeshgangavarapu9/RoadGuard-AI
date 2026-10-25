package com.roadguard.api.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "investigation_results")
public class InvestigationResult {

    public enum AuthorityConfidence { HIGH, MEDIUM, LOW, UNKNOWN }
    public enum InvestigatedBy { DETERMINISTIC_RULES, AI_AGENT_MOCK, AI_AGENT_LIVE }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "road_issue_id", nullable = false, unique = true)
    private RoadIssue roadIssue;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "candidate_authority_id")
    private AuthorityRecord candidateAuthority;

    @Column(length = 500)
    private String authorityReason;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private AuthorityConfidence authorityConfidence = AuthorityConfidence.UNKNOWN;

    @Column(nullable = false)
    private Boolean dlpApplicable = false;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "dlp_contractor_id")
    private ContractorRecord dlpContractor;

    private LocalDate dlpEndDate;

    // Evidence tier: 1=Verified official record, 2=Inferred, 3=Candidate, 4=Not found
    @Column(nullable = false)
    private Integer evidenceTier = 4;

    @Column(length = 2000)
    private String evidenceSummary;

    @Column(length = 1000)
    private String missingInformation;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private InvestigatedBy investigatedBy = InvestigatedBy.DETERMINISTIC_RULES;

    @Column(nullable = false)
    private Instant investigatedAt = Instant.now();

    @Column(length = 2000)
    private String investigationNotes;

    // ── Getters and setters ──
    public Long getId() { return id; }
    public RoadIssue getRoadIssue() { return roadIssue; }
    public void setRoadIssue(RoadIssue roadIssue) { this.roadIssue = roadIssue; }
    public AuthorityRecord getCandidateAuthority() { return candidateAuthority; }
    public void setCandidateAuthority(AuthorityRecord candidateAuthority) { this.candidateAuthority = candidateAuthority; }
    public String getAuthorityReason() { return authorityReason; }
    public void setAuthorityReason(String authorityReason) { this.authorityReason = authorityReason; }
    public AuthorityConfidence getAuthorityConfidence() { return authorityConfidence; }
    public void setAuthorityConfidence(AuthorityConfidence authorityConfidence) { this.authorityConfidence = authorityConfidence; }
    public Boolean getDlpApplicable() { return dlpApplicable; }
    public void setDlpApplicable(Boolean dlpApplicable) { this.dlpApplicable = dlpApplicable; }
    public ContractorRecord getDlpContractor() { return dlpContractor; }
    public void setDlpContractor(ContractorRecord dlpContractor) { this.dlpContractor = dlpContractor; }
    public LocalDate getDlpEndDate() { return dlpEndDate; }
    public void setDlpEndDate(LocalDate dlpEndDate) { this.dlpEndDate = dlpEndDate; }
    public Integer getEvidenceTier() { return evidenceTier; }
    public void setEvidenceTier(Integer evidenceTier) { this.evidenceTier = evidenceTier; }
    public String getEvidenceSummary() { return evidenceSummary; }
    public void setEvidenceSummary(String evidenceSummary) { this.evidenceSummary = evidenceSummary; }
    public String getMissingInformation() { return missingInformation; }
    public void setMissingInformation(String missingInformation) { this.missingInformation = missingInformation; }
    public InvestigatedBy getInvestigatedBy() { return investigatedBy; }
    public void setInvestigatedBy(InvestigatedBy investigatedBy) { this.investigatedBy = investigatedBy; }
    public Instant getInvestigatedAt() { return investigatedAt; }
    public void setInvestigatedAt(Instant investigatedAt) { this.investigatedAt = investigatedAt; }
    public String getInvestigationNotes() { return investigationNotes; }
    public void setInvestigationNotes(String investigationNotes) { this.investigationNotes = investigationNotes; }
}
