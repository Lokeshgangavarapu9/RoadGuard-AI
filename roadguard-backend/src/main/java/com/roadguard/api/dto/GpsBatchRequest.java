package com.roadguard.api.dto;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public class GpsBatchRequest {

    @NotEmpty
    private List<GpsPointDto> points;

    public List<GpsPointDto> getPoints() { return points; }
    public void setPoints(List<GpsPointDto> points) { this.points = points; }
}
