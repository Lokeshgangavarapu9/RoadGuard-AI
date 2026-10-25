package com.roadguard.api.dto;

import com.roadguard.api.entity.Journey;
import jakarta.validation.constraints.Email;

public class CreateJourneyRequest {

    private Journey.VehicleType vehicleType = Journey.VehicleType.CAR;
    private String riderName;

    @Email
    private String riderEmail;

    private Double startLatitude;
    private Double startLongitude;
    private String startAddress;
    private Boolean demoMode = false;
    private String demoSource;
    private String notes;

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
    public Boolean getDemoMode() { return demoMode; }
    public void setDemoMode(Boolean demoMode) { this.demoMode = demoMode; }
    public String getDemoSource() { return demoSource; }
    public void setDemoSource(String demoSource) { this.demoSource = demoSource; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
