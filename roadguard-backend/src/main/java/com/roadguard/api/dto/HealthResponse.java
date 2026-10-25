package com.roadguard.api.dto;

import java.time.Instant;

public class HealthResponse {

    private String status;
    private String database;
    private String inferenceMode;
    private String storageType;
    private Instant timestamp = Instant.now();
    private String version = "0.1.0-STAGE-A";

    private String modelStatus;
    private String modelPath;

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getDatabase() { return database; }
    public void setDatabase(String database) { this.database = database; }
    public String getInferenceMode() { return inferenceMode; }
    public void setInferenceMode(String inferenceMode) { this.inferenceMode = inferenceMode; }
    public String getModelStatus() { return modelStatus; }
    public void setModelStatus(String modelStatus) { this.modelStatus = modelStatus; }
    public String getModelPath() { return modelPath; }
    public void setModelPath(String modelPath) { this.modelPath = modelPath; }
    public String getStorageType() { return storageType; }
    public void setStorageType(String storageType) { this.storageType = storageType; }
    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }
    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }
}
