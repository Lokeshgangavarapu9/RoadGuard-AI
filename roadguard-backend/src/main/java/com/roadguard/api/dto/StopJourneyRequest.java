package com.roadguard.api.dto;

public class StopJourneyRequest {
    private String notes;
    private Double endLatitude;
    private Double endLongitude;
    private String endAddress;
    private Double distanceMeters;

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
