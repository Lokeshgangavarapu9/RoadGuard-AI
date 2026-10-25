package com.roadguard.api.dto;

import jakarta.validation.constraints.NotBlank;

public class RecordReceiptRequest {

    @NotBlank(message = "officialRefId is required")
    private String officialRefId;

    private String notes;

    public String getOfficialRefId() { return officialRefId; }
    public void setOfficialRefId(String officialRefId) { this.officialRefId = officialRefId; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
