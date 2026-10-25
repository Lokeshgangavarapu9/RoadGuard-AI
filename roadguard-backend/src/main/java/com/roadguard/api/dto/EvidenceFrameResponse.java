package com.roadguard.api.dto;

import com.roadguard.api.entity.EvidenceFrame;
import java.time.Instant;

public class EvidenceFrameResponse {

    private Long id;
    private String uuid;
    private Long journeyId;
    private String storageKey;
    private String storageUrl;
    private String originalFilename;
    private String contentType;
    private Long fileSizeBytes;
    private String sha256Digest;
    private Boolean piiProcessed;
    private Double latitude;
    private Double longitude;
    private Instant capturedAt;
    private Instant receivedAt;
    private EvidenceFrame.SourceType sourceType;
    private Integer frameSequence;
    private EvidenceFrame.InferenceStatus inferenceStatus;
    private Integer observationCount;
    private java.util.List<ObservationDto> observations = new java.util.ArrayList<>();

    public static class ObservationDto {
        private String rawClassLabel;
        private Double rawConfidence;
        private Double bboxX1;
        private Double bboxY1;
        private Double bboxX2;
        private Double bboxY2;
        private Boolean confirmed;
        private String inferenceMode;

        public String getRawClassLabel() { return rawClassLabel; }
        public void setRawClassLabel(String rawClassLabel) { this.rawClassLabel = rawClassLabel; }
        public Double getRawConfidence() { return rawConfidence; }
        public void setRawConfidence(Double rawConfidence) { this.rawConfidence = rawConfidence; }
        public Double getBboxX1() { return bboxX1; }
        public void setBboxX1(Double bboxX1) { this.bboxX1 = bboxX1; }
        public Double getBboxY1() { return bboxY1; }
        public void setBboxY1(Double bboxY1) { this.bboxY1 = bboxY1; }
        public Double getBboxX2() { return bboxX2; }
        public void setBboxX2(Double bboxX2) { this.bboxX2 = bboxX2; }
        public Double getBboxY2() { return bboxY2; }
        public void setBboxY2(Double bboxY2) { this.bboxY2 = bboxY2; }
        public Boolean getConfirmed() { return confirmed; }
        public void setConfirmed(Boolean confirmed) { this.confirmed = confirmed; }
        public String getInferenceMode() { return inferenceMode; }
        public void setInferenceMode(String inferenceMode) { this.inferenceMode = inferenceMode; }
    }

    public static EvidenceFrameResponse fromEntity(EvidenceFrame f, Integer observationCount) {
        EvidenceFrameResponse r = new EvidenceFrameResponse();
        r.setId(f.getId());
        r.setUuid(f.getUuid());
        r.setJourneyId(f.getJourney().getId());
        r.setStorageKey(f.getStorageKey());
        r.setStorageUrl("/uploads/" + f.getStorageKey().replace("\\", "/"));
        r.setOriginalFilename(f.getOriginalFilename());
        r.setContentType(f.getContentType());
        r.setFileSizeBytes(f.getFileSizeBytes());
        r.setSha256Digest(f.getSha256Digest());
        r.setPiiProcessed(f.getPiiProcessed());
        r.setLatitude(f.getLatitude());
        r.setLongitude(f.getLongitude());
        r.setCapturedAt(f.getCapturedAt());
        r.setReceivedAt(f.getReceivedAt());
        r.setSourceType(f.getSourceType());
        r.setFrameSequence(f.getFrameSequence());
        r.setInferenceStatus(f.getInferenceStatus());
        r.setObservationCount(observationCount != null ? observationCount : 0);
        return r;
    }

    public static EvidenceFrameResponse fromEntity(EvidenceFrame f, java.util.List<com.roadguard.api.entity.DetectionObservation> obsList) {
        EvidenceFrameResponse r = fromEntity(f, obsList != null ? obsList.size() : 0);
        if (obsList != null) {
            for (com.roadguard.api.entity.DetectionObservation o : obsList) {
                ObservationDto dto = new ObservationDto();
                dto.setRawClassLabel(o.getRawClassLabel());
                dto.setRawConfidence(o.getRawConfidence());
                dto.setBboxX1(o.getBboxX1());
                dto.setBboxY1(o.getBboxY1());
                dto.setBboxX2(o.getBboxX2());
                dto.setBboxY2(o.getBboxY2());
                dto.setConfirmed(o.getConfirmed());
                dto.setInferenceMode(o.getInferenceMode());
                r.getObservations().add(dto);
            }
        }
        return r;
    }

    public java.util.List<ObservationDto> getObservations() { return observations; }
    public void setObservations(java.util.List<ObservationDto> observations) { this.observations = observations; }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }
    public Long getJourneyId() { return journeyId; }
    public void setJourneyId(Long journeyId) { this.journeyId = journeyId; }
    public String getStorageKey() { return storageKey; }
    public void setStorageKey(String storageKey) { this.storageKey = storageKey; }
    public String getStorageUrl() { return storageUrl; }
    public void setStorageUrl(String storageUrl) { this.storageUrl = storageUrl; }
    public String getOriginalFilename() { return originalFilename; }
    public void setOriginalFilename(String originalFilename) { this.originalFilename = originalFilename; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    public Long getFileSizeBytes() { return fileSizeBytes; }
    public void setFileSizeBytes(Long fileSizeBytes) { this.fileSizeBytes = fileSizeBytes; }
    public String getSha256Digest() { return sha256Digest; }
    public void setSha256Digest(String sha256Digest) { this.sha256Digest = sha256Digest; }
    public Boolean getPiiProcessed() { return piiProcessed; }
    public void setPiiProcessed(Boolean piiProcessed) { this.piiProcessed = piiProcessed; }
    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }
    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }
    public Instant getCapturedAt() { return capturedAt; }
    public void setCapturedAt(Instant capturedAt) { this.capturedAt = capturedAt; }
    public Instant getReceivedAt() { return receivedAt; }
    public void setReceivedAt(Instant receivedAt) { this.receivedAt = receivedAt; }
    public EvidenceFrame.SourceType getSourceType() { return sourceType; }
    public void setSourceType(EvidenceFrame.SourceType sourceType) { this.sourceType = sourceType; }
    public Integer getFrameSequence() { return frameSequence; }
    public void setFrameSequence(Integer frameSequence) { this.frameSequence = frameSequence; }
    public EvidenceFrame.InferenceStatus getInferenceStatus() { return inferenceStatus; }
    public void setInferenceStatus(EvidenceFrame.InferenceStatus inferenceStatus) { this.inferenceStatus = inferenceStatus; }
    public Integer getObservationCount() { return observationCount; }
    public void setObservationCount(Integer observationCount) { this.observationCount = observationCount; }
}
