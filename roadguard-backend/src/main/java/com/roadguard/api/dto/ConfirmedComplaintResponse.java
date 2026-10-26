package com.roadguard.api.dto;

import java.time.Instant;
import java.util.List;

/**
 * DTO representing a genuinely confirmed road-damage complaint successfully raised
 * on an official government portal.
 *
 * <p>Strict Anti-Fabrication Rule:
 * Only confirmed records with real portal references (excluding MOCK / SIMULATED / UNVERIFIED)
 * appear in this response.</p>
 */
public class ConfirmedComplaintResponse {

    private Long complaintId;
    private String complaintUuid;
    private Long journeyId;
    private Long roadIssueId;
    private String portalName;
    private String officialPortalUrl;
    private String officialRefId;
    private String defectCategory;
    private String description;
    private String roadName;
    private Double latitude;
    private Double longitude;
    private Instant submittedAt;
    private String filingChannel;
    private List<String> evidencePhotoUrls;

    public ConfirmedComplaintResponse() {}

    public Long getComplaintId() { return complaintId; }
    public void setComplaintId(Long complaintId) { this.complaintId = complaintId; }

    public String getComplaintUuid() { return complaintUuid; }
    public void setComplaintUuid(String complaintUuid) { this.complaintUuid = complaintUuid; }

    public Long getJourneyId() { return journeyId; }
    public void setJourneyId(Long journeyId) { this.journeyId = journeyId; }

    public Long getRoadIssueId() { return roadIssueId; }
    public void setRoadIssueId(Long roadIssueId) { this.roadIssueId = roadIssueId; }

    public String getPortalName() { return portalName; }
    public void setPortalName(String portalName) { this.portalName = portalName; }

    public String getOfficialPortalUrl() { return officialPortalUrl; }
    public void setOfficialPortalUrl(String officialPortalUrl) { this.officialPortalUrl = officialPortalUrl; }

    public String getOfficialRefId() { return officialRefId; }
    public void setOfficialRefId(String officialRefId) { this.officialRefId = officialRefId; }

    public String getDefectCategory() { return defectCategory; }
    public void setDefectCategory(String defectCategory) { this.defectCategory = defectCategory; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getRoadName() { return roadName; }
    public void setRoadName(String roadName) { this.roadName = roadName; }

    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }

    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }

    public Instant getSubmittedAt() { return submittedAt; }
    public void setSubmittedAt(Instant submittedAt) { this.submittedAt = submittedAt; }

    public String getFilingChannel() { return filingChannel; }
    public void setFilingChannel(String filingChannel) { this.filingChannel = filingChannel; }

    public List<String> getEvidencePhotoUrls() { return evidencePhotoUrls; }
    public void setEvidencePhotoUrls(List<String> evidencePhotoUrls) { this.evidencePhotoUrls = evidencePhotoUrls; }
}
