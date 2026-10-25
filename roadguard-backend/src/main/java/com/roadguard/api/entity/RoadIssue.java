package com.roadguard.api.entity;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * A confirmed road defect / issue.
 *
 * <p>An issue is created after temporal confirmation (2-of-4 frames
 * at Stage A mock inference). Multiple detection observations can
 * be merged into one issue via spatial deduplication.</p>
 *
 * <p>Stage A: GPS coordinates stored as plain doubles.
 * Stage B: Add PostGIS GEOGRAPHY(POINT, 4326) column for ST_DWithin queries.</p>
 */
@Entity
@Table(name = "road_issues")
public class RoadIssue {

    public enum DefectClass {
        POTHOLE, ROAD_CRACK, ALLIGATOR_CRACK, TRANSVERSE_CRACK, WATERLOGGING, UNKNOWN
    }

    public enum Severity { LOW, MEDIUM, HIGH, CRITICAL, UNKNOWN }

    public enum DetectionMode {
        REAL_ONNX, REAL_HTTP, MOCK, DEMO_REPLAY, MANUAL
    }

    public enum IssueStatus {
        DETECTED, INVESTIGATING, COMPLAINT_DRAFTED, COMPLAINT_SUBMITTED,
        RESOLVED, DUPLICATE, INVALID
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 36)
    private String uuid;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "journey_id", nullable = false)
    private Journey journey;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private DefectClass defectClass;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Severity severity = Severity.UNKNOWN;

    @Column(nullable = false)
    private Double latitude;

    @Column(nullable = false)
    private Double longitude;

    @Column(name = "location_accuracy_m")
    private Double locationAccuracyM;

    @Column(length = 500)
    private String address;

    @Column(length = 300)
    private String roadName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private DetectionMode detectionMode = DetectionMode.MOCK;

    private Double confidenceScore;

    @Column(nullable = false)
    private Integer observationCount = 1;

    @Column(nullable = false)
    private Instant firstSeenAt = Instant.now();

    @Column(nullable = false)
    private Instant lastSeenAt = Instant.now();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private IssueStatus status = IssueStatus.DETECTED;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "duplicate_of_id")
    private RoadIssue duplicateOf;

    @Column(length = 1000)
    private String notes;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    @Column(nullable = false)
    private Instant updatedAt = Instant.now();

    @PreUpdate
    protected void onUpdate() { this.updatedAt = Instant.now(); }

    // ── Getters and setters ──
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }
    public Journey getJourney() { return journey; }
    public void setJourney(Journey journey) { this.journey = journey; }
    public DefectClass getDefectClass() { return defectClass; }
    public void setDefectClass(DefectClass defectClass) { this.defectClass = defectClass; }
    public Severity getSeverity() { return severity; }
    public void setSeverity(Severity severity) { this.severity = severity; }
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
    public DetectionMode getDetectionMode() { return detectionMode; }
    public void setDetectionMode(DetectionMode detectionMode) { this.detectionMode = detectionMode; }
    public Double getConfidenceScore() { return confidenceScore; }
    public void setConfidenceScore(Double confidenceScore) { this.confidenceScore = confidenceScore; }
    public Integer getObservationCount() { return observationCount; }
    public void setObservationCount(Integer observationCount) { this.observationCount = observationCount; }
    public Instant getFirstSeenAt() { return firstSeenAt; }
    public void setFirstSeenAt(Instant firstSeenAt) { this.firstSeenAt = firstSeenAt; }
    public Instant getLastSeenAt() { return lastSeenAt; }
    public void setLastSeenAt(Instant lastSeenAt) { this.lastSeenAt = lastSeenAt; }
    public IssueStatus getStatus() { return status; }
    public void setStatus(IssueStatus status) { this.status = status; }
    public RoadIssue getDuplicateOf() { return duplicateOf; }
    public void setDuplicateOf(RoadIssue duplicateOf) { this.duplicateOf = duplicateOf; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
