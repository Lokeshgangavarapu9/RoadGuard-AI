package com.roadguard.api.dto;

import com.roadguard.api.entity.RoadIssue;
import java.time.Instant;

public class RoadIssueResponse {

    private Long id;
    private String uuid;
    private Long journeyId;
    private RoadIssue.DefectClass defectClass;
    private RoadIssue.Severity severity;
    private Double latitude;
    private Double longitude;
    private Double locationAccuracyM;
    private String address;
    private String roadName;
    private RoadIssue.DetectionMode detectionMode;
    private Double confidenceScore;
    private Integer observationCount;
    private Instant firstSeenAt;
    private Instant lastSeenAt;
    private RoadIssue.IssueStatus status;
    private Instant createdAt;
    private Instant updatedAt;

    private String locationSource;
    private String cityOrTown;
    private String district;
    private String state;
    private String pincode;

    // Attached investigation summary if present
    private String authorityCode;
    private String authorityName;
    private Boolean dlpApplicable;
    private Integer evidenceTier;

    // Representative frame info
    private Long representativeFrameId;
    private String representativeFrameUrl;

    public static RoadIssueResponse fromEntity(RoadIssue issue) {
        RoadIssueResponse r = new RoadIssueResponse();
        r.setId(issue.getId());
        r.setUuid(issue.getUuid());
        r.setJourneyId(issue.getJourney().getId());
        r.setDefectClass(issue.getDefectClass());
        r.setSeverity(issue.getSeverity());
        r.setLatitude(issue.getLatitude());
        r.setLongitude(issue.getLongitude());
        r.setLocationAccuracyM(issue.getLocationAccuracyM());
        r.setLocationSource(issue.getLocationSource());
        r.setCityOrTown(issue.getCityOrTown());
        r.setDistrict(issue.getDistrict());
        r.setState(issue.getState());
        r.setPincode(issue.getPincode());
        r.setAddress(issue.getAddress());
        r.setRoadName(issue.getRoadName());
        r.setDetectionMode(issue.getDetectionMode());
        r.setConfidenceScore(issue.getConfidenceScore());
        r.setObservationCount(issue.getObservationCount());
        r.setFirstSeenAt(issue.getFirstSeenAt());
        r.setLastSeenAt(issue.getLastSeenAt());
        r.setStatus(issue.getStatus());
        r.setCreatedAt(issue.getCreatedAt());
        r.setUpdatedAt(issue.getUpdatedAt());
        return r;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }
    public Long getJourneyId() { return journeyId; }
    public void setJourneyId(Long journeyId) { this.journeyId = journeyId; }
    public RoadIssue.DefectClass getDefectClass() { return defectClass; }
    public void setDefectClass(RoadIssue.DefectClass defectClass) { this.defectClass = defectClass; }
    public RoadIssue.Severity getSeverity() { return severity; }
    public void setSeverity(RoadIssue.Severity severity) { this.severity = severity; }
    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }
    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }
    public Double getLocationAccuracyM() { return locationAccuracyM; }
    public void setLocationAccuracyM(Double locationAccuracyM) { this.locationAccuracyM = locationAccuracyM; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public String getRoadName() { return roadName; }
    public void setRoadName(String roadName) { this.roadName = roadName; }
    public RoadIssue.DetectionMode getDetectionMode() { return detectionMode; }
    public void setDetectionMode(RoadIssue.DetectionMode detectionMode) { this.detectionMode = detectionMode; }
    public Double getConfidenceScore() { return confidenceScore; }
    public void setConfidenceScore(Double confidenceScore) { this.confidenceScore = confidenceScore; }
    public Integer getObservationCount() { return observationCount; }
    public void setObservationCount(Integer observationCount) { this.observationCount = observationCount; }
    public Instant getFirstSeenAt() { return firstSeenAt; }
    public void setFirstSeenAt(Instant firstSeenAt) { this.firstSeenAt = firstSeenAt; }
    public Instant getLastSeenAt() { return lastSeenAt; }
    public void setLastSeenAt(Instant lastSeenAt) { this.lastSeenAt = lastSeenAt; }
    public RoadIssue.IssueStatus getStatus() { return status; }
    public void setStatus(RoadIssue.IssueStatus status) { this.status = status; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
    public String getAuthorityCode() { return authorityCode; }
    public void setAuthorityCode(String authorityCode) { this.authorityCode = authorityCode; }
    public String getAuthorityName() { return authorityName; }
    public void setAuthorityName(String authorityName) { this.authorityName = authorityName; }
    public Boolean getDlpApplicable() { return dlpApplicable; }
    public void setDlpApplicable(Boolean dlpApplicable) { this.dlpApplicable = dlpApplicable; }
    public Integer getEvidenceTier() { return evidenceTier; }
    public void setEvidenceTier(Integer evidenceTier) { this.evidenceTier = evidenceTier; }
    public Long getRepresentativeFrameId() { return representativeFrameId; }
    public void setRepresentativeFrameId(Long representativeFrameId) { this.representativeFrameId = representativeFrameId; }
    public String getRepresentativeFrameUrl() { return representativeFrameUrl; }
    public void setRepresentativeFrameUrl(String representativeFrameUrl) { this.representativeFrameUrl = representativeFrameUrl; }
    public String getLocationSource() { return locationSource; }
    public void setLocationSource(String locationSource) { this.locationSource = locationSource; }
    public String getCityOrTown() { return cityOrTown; }
    public void setCityOrTown(String cityOrTown) { this.cityOrTown = cityOrTown; }
    public String getDistrict() { return district; }
    public void setDistrict(String district) { this.district = district; }
    public String getState() { return state; }
    public void setState(String state) { this.state = state; }
    public String getPincode() { return pincode; }
    public void setPincode(String pincode) { this.pincode = pincode; }
}
