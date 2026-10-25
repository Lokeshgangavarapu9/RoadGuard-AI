package com.roadguard.api.dto;

import com.roadguard.api.entity.Journey;
import java.time.Instant;

public class JourneyResponse {

    private Long id;
    private String uuid;
    private Journey.JourneyStatus status;
    private Journey.VehicleType vehicleType;
    private String riderName;
    private String riderEmail;
    private Double startLatitude;
    private Double startLongitude;
    private String startAddress;
    private Double endLatitude;
    private Double endLongitude;
    private String endAddress;
    private Double distanceMeters;
    private Instant createdAt;
    private Instant startedAt;
    private Instant stoppedAt;
    private Integer totalFrames;
    private Integer processedFrames;
    private Boolean demoMode;
    private String demoSource;
    private String notes;
    private Long issueCount;
    private Long gpsPointCount;

    public static JourneyResponse fromEntity(Journey j, Long issueCount, Long gpsPointCount) {
        JourneyResponse r = new JourneyResponse();
        r.setId(j.getId());
        r.setUuid(j.getUuid());
        r.setStatus(j.getStatus());
        r.setVehicleType(j.getVehicleType());
        r.setRiderName(j.getRiderName());
        r.setRiderEmail(j.getRiderEmail());
        r.setStartLatitude(j.getStartLatitude());
        r.setStartLongitude(j.getStartLongitude());
        r.setStartAddress(j.getStartAddress());
        r.setEndLatitude(j.getEndLatitude());
        r.setEndLongitude(j.getEndLongitude());
        r.setEndAddress(j.getEndAddress());
        r.setDistanceMeters(j.getDistanceMeters());
        r.setCreatedAt(j.getCreatedAt());
        r.setStartedAt(j.getStartedAt());
        r.setStoppedAt(j.getStoppedAt());
        r.setTotalFrames(j.getTotalFrames());
        r.setProcessedFrames(j.getProcessedFrames());
        r.setDemoMode(j.getDemoMode());
        r.setDemoSource(j.getDemoSource());
        r.setNotes(j.getNotes());
        r.setIssueCount(issueCount != null ? issueCount : 0L);
        r.setGpsPointCount(gpsPointCount != null ? gpsPointCount : 0L);
        return r;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }
    public Journey.JourneyStatus getStatus() { return status; }
    public void setStatus(Journey.JourneyStatus status) { this.status = status; }
    public Journey.VehicleType getVehicleType() { return vehicleType; }
    public void setVehicleType(Journey.VehicleType vehicleType) { this.vehicleType = vehicleType; }
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
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
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
    public Long getIssueCount() { return issueCount; }
    public void setIssueCount(Long issueCount) { this.issueCount = issueCount; }
    public Long getGpsPointCount() { return gpsPointCount; }
    public void setGpsPointCount(Long gpsPointCount) { this.gpsPointCount = gpsPointCount; }
    public Double getEndLatitude() { return endLatitude; }
    public void setEndLatitude(Double endLatitude) { this.endLatitude = endLatitude; }
    public Double getEndLongitude() { return endLongitude; }
    public void setEndLongitude(Double endLongitude) { this.endLongitude = endLongitude; }
    public String getEndAddress() { return endAddress; }
    public void setEndAddress(String endAddress) { this.endAddress = endAddress; }
    public Double getDistanceMeters() { return distanceMeters; }
    public void setDistanceMeters(Double distanceMeters) { this.distanceMeters = distanceMeters; }
}
