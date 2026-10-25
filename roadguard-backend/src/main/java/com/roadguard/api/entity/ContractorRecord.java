package com.roadguard.api.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "contractor_records")
public class ContractorRecord {

    public enum VerificationStatus {
        VERIFIED, UNVERIFIED, UNKNOWN
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "authority_id")
    private AuthorityRecord authority;

    @Column(length = 200)
    private String tenderId;

    @Column(length = 100)
    private String packageNumber;

    @Column(length = 300)
    private String roadName;

    private Double chainageFrom;
    private Double chainageTo;

    @Column(length = 300)
    private String contractorName;

    private Double contractValueLakhs;
    private LocalDate workStartDate;
    private LocalDate workEndDate;
    private LocalDate dlpEndDate;

    @Column(length = 100)
    private String district;

    @Column(length = 500)
    private String sourceUrl;

    @Column(length = 300)
    private String sourceTitle;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private VerificationStatus verificationStatus = VerificationStatus.UNVERIFIED;

    private Instant accessedAt;

    @Column(length = 1000)
    private String notes;

    public Long getId() { return id; }
    public AuthorityRecord getAuthority() { return authority; }
    public void setAuthority(AuthorityRecord authority) { this.authority = authority; }
    public String getTenderId() { return tenderId; }
    public void setTenderId(String tenderId) { this.tenderId = tenderId; }
    public String getPackageNumber() { return packageNumber; }
    public void setPackageNumber(String packageNumber) { this.packageNumber = packageNumber; }
    public String getRoadName() { return roadName; }
    public void setRoadName(String roadName) { this.roadName = roadName; }
    public Double getChainageFrom() { return chainageFrom; }
    public void setChainageFrom(Double chainageFrom) { this.chainageFrom = chainageFrom; }
    public Double getChainageTo() { return chainageTo; }
    public void setChainageTo(Double chainageTo) { this.chainageTo = chainageTo; }
    public String getContractorName() { return contractorName; }
    public void setContractorName(String contractorName) { this.contractorName = contractorName; }
    public Double getContractValueLakhs() { return contractValueLakhs; }
    public void setContractValueLakhs(Double contractValueLakhs) { this.contractValueLakhs = contractValueLakhs; }
    public LocalDate getWorkStartDate() { return workStartDate; }
    public void setWorkStartDate(LocalDate workStartDate) { this.workStartDate = workStartDate; }
    public LocalDate getWorkEndDate() { return workEndDate; }
    public void setWorkEndDate(LocalDate workEndDate) { this.workEndDate = workEndDate; }
    public LocalDate getDlpEndDate() { return dlpEndDate; }
    public void setDlpEndDate(LocalDate dlpEndDate) { this.dlpEndDate = dlpEndDate; }
    public String getDistrict() { return district; }
    public void setDistrict(String district) { this.district = district; }
    public String getSourceUrl() { return sourceUrl; }
    public void setSourceUrl(String sourceUrl) { this.sourceUrl = sourceUrl; }
    public String getSourceTitle() { return sourceTitle; }
    public void setSourceTitle(String sourceTitle) { this.sourceTitle = sourceTitle; }
    public VerificationStatus getVerificationStatus() { return verificationStatus; }
    public void setVerificationStatus(VerificationStatus verificationStatus) { this.verificationStatus = verificationStatus; }
    public Instant getAccessedAt() { return accessedAt; }
    public void setAccessedAt(Instant accessedAt) { this.accessedAt = accessedAt; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
