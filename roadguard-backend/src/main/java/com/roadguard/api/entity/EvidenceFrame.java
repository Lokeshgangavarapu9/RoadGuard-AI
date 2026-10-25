package com.roadguard.api.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "evidence_frames")
public class EvidenceFrame {

    public enum StorageType { LOCAL, MINIO, S3 }
    public enum SourceType { LIVE_CAMERA, PRERECORDED, UPLOADED_STATIC }
    public enum InferenceStatus { PENDING, PROCESSING, DONE, SKIPPED, FAILED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 36)
    private String uuid;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "journey_id", nullable = false)
    private Journey journey;

    @Column(nullable = false, length = 500)
    private String storageKey;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StorageType storageType = StorageType.LOCAL;

    @Column(length = 255)
    private String originalFilename;

    @Column(length = 100)
    private String contentType;

    private Long fileSizeBytes;

    @Column(name = "sha256_digest", length = 64)
    private String sha256Digest;

    @Column(nullable = false)
    private Boolean piiProcessed = false;

    private Double latitude;
    private Double longitude;

    private Instant capturedAt;

    @Column(nullable = false)
    private Instant receivedAt = Instant.now();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private SourceType sourceType = SourceType.LIVE_CAMERA;

    private Integer frameSequence;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private InferenceStatus inferenceStatus = InferenceStatus.PENDING;

    @Column(name = "sharpness_score")
    private Double sharpnessScore;

    @Column(name = "brightness_score")
    private Double brightnessScore;

    @Column(name = "quality_status", length = 30)
    private String qualityStatus = "CLEAR";

    @Column(name = "gps_accuracy_m")
    private Double gpsAccuracyM;

    @Column(name = "heading_deg")
    private Double headingDeg;

    @Column(name = "speed_mps")
    private Double speedMps;

    @Column(name = "image_width")
    private Integer imageWidth;

    @Column(name = "image_height")
    private Integer imageHeight;

    // ── Getters and setters ──
    public Long getId() { return id; }
    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }
    public Journey getJourney() { return journey; }
    public void setJourney(Journey journey) { this.journey = journey; }
    public String getStorageKey() { return storageKey; }
    public void setStorageKey(String storageKey) { this.storageKey = storageKey; }
    public StorageType getStorageType() { return storageType; }
    public void setStorageType(StorageType storageType) { this.storageType = storageType; }
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
    public SourceType getSourceType() { return sourceType; }
    public void setSourceType(SourceType sourceType) { this.sourceType = sourceType; }
    public Integer getFrameSequence() { return frameSequence; }
    public void setFrameSequence(Integer frameSequence) { this.frameSequence = frameSequence; }
    public InferenceStatus getInferenceStatus() { return inferenceStatus; }
    public void setInferenceStatus(InferenceStatus inferenceStatus) { this.inferenceStatus = inferenceStatus; }
    public Double getSharpnessScore() { return sharpnessScore; }
    public void setSharpnessScore(Double sharpnessScore) { this.sharpnessScore = sharpnessScore; }
    public Double getBrightnessScore() { return brightnessScore; }
    public void setBrightnessScore(Double brightnessScore) { this.brightnessScore = brightnessScore; }
    public String getQualityStatus() { return qualityStatus; }
    public void setQualityStatus(String qualityStatus) { this.qualityStatus = qualityStatus; }
    public Double getGpsAccuracyM() { return gpsAccuracyM; }
    public void setGpsAccuracyM(Double gpsAccuracyM) { this.gpsAccuracyM = gpsAccuracyM; }
    public Double getHeadingDeg() { return headingDeg; }
    public void setHeadingDeg(Double headingDeg) { this.headingDeg = headingDeg; }
    public Double getSpeedMps() { return speedMps; }
    public void setSpeedMps(Double speedMps) { this.speedMps = speedMps; }
    public Integer getImageWidth() { return imageWidth; }
    public void setImageWidth(Integer imageWidth) { this.imageWidth = imageWidth; }
    public Integer getImageHeight() { return imageHeight; }
    public void setImageHeight(Integer imageHeight) { this.imageHeight = imageHeight; }
}
