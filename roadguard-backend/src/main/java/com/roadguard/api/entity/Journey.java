package com.roadguard.api.entity;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * Represents a road-monitoring journey session.
 *
 * <p>A journey begins when the user taps "Start Journey" and ends
 * when they tap "Stop Journey". All GPS telemetry, evidence frames,
 * and detections are associated with a journey.</p>
 */
@Entity
@Table(name = "journeys")
public class Journey {

    public enum JourneyStatus { CREATED, ACTIVE, STOPPED, CANCELLED }
    public enum VehicleType { CAR, BIKE, AUTO, TRUCK }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 36)
    private String uuid;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private JourneyStatus status = JourneyStatus.CREATED;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private VehicleType vehicleType;

    @Column(length = 100)
    private String riderName;

    @Column(length = 200)
    private String riderEmail;

    private Double startLatitude;
    private Double startLongitude;

    @Column(length = 500)
    private String startAddress;

    private Double endLatitude;
    private Double endLongitude;

    @Column(length = 500)
    private String endAddress;

    private Double distanceMeters = 0.0;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    private Instant startedAt;
    private Instant stoppedAt;

    @Column(nullable = false)
    private Integer totalFrames = 0;

    @Column(nullable = false)
    private Integer processedFrames = 0;

    @Column(nullable = false)
    private Boolean demoMode = false;

    @Column(length = 200)
    private String demoSource;

    @Column(length = 1000)
    private String notes;

    // ── Getters and setters ──────────────────────────────────

    public Long getId() { return id; }
    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }
    public JourneyStatus getStatus() { return status; }
    public void setStatus(JourneyStatus status) { this.status = status; }
    public VehicleType getVehicleType() { return vehicleType; }
    public void setVehicleType(VehicleType vehicleType) { this.vehicleType = vehicleType; }
    public String getRiderName() { return riderName; }
    public void setRiderName(String riderName) { this.riderName = riderName; }
    public String getRiderEmail() { return riderEmail; }
    public void setRiderEmail(String riderEmail) { this.riderEmail = riderEmail; }
    public Double getStartLatitude() { return startLatitude; }
    public void setStartLatitude(Double startLatitude) { this.startLatitude = startLatitude; }
    public Double getStartLongitude() { return startLongitude; }
    public void setStartLongitude(Double startLongitude) { this.startLongitude = startLongitude; }
    public String getStartAddress() { return startAddress; }
    public void setStartAddress(String startAddress) { this.startAddress = startAddress; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant startedAt) { this.startedAt = startedAt; }
    public Instant getStoppedAt() { return stoppedAt; }
    public void setStoppedAt(Instant stoppedAt) { this.stoppedAt = stoppedAt; }
    public Integer getTotalFrames() { return totalFrames; }
    public void setTotalFrames(Integer totalFrames) { this.totalFrames = totalFrames; }
    public Integer getProcessedFrames() { return processedFrames; }
    public void setProcessedFrames(Integer processedFrames) { this.processedFrames = processedFrames; }
    public Boolean getDemoMode() { return demoMode; }
    public void setDemoMode(Boolean demoMode) { this.demoMode = demoMode; }
    public String getDemoSource() { return demoSource; }
    public void setDemoSource(String demoSource) { this.demoSource = demoSource; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public Double getEndLatitude() { return endLatitude; }
    public void setEndLatitude(Double endLatitude) { this.endLatitude = endLatitude; }
    public Double getEndLongitude() { return endLongitude; }
    public void setEndLongitude(Double endLongitude) { this.endLongitude = endLongitude; }
    public String getEndAddress() { return endAddress; }
    public void setEndAddress(String endAddress) { this.endAddress = endAddress; }
    public Double getDistanceMeters() { return distanceMeters; }
    public void setDistanceMeters(Double distanceMeters) { this.distanceMeters = distanceMeters; }
}
