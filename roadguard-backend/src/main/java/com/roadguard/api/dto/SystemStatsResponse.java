package com.roadguard.api.dto;



public class SystemStatsResponse {

    private long totalJourneys;
    private long activeJourneys;
    private long totalFrames;
    private long totalRoadIssues;
    private long potholesCount;
    private long cracksCount;
    private long totalComplaints;
    private long simulatedComplaints;

    public long getTotalJourneys() { return totalJourneys; }
    public void setTotalJourneys(long totalJourneys) { this.totalJourneys = totalJourneys; }
    public long getActiveJourneys() { return activeJourneys; }
    public void setActiveJourneys(long activeJourneys) { this.activeJourneys = activeJourneys; }
    public long getTotalFrames() { return totalFrames; }
    public void setTotalFrames(long totalFrames) { this.totalFrames = totalFrames; }
    public long getTotalRoadIssues() { return totalRoadIssues; }
    public void setTotalRoadIssues(long totalRoadIssues) { this.totalRoadIssues = totalRoadIssues; }
    public long getPotholesCount() { return potholesCount; }
    public void setPotholesCount(long potholesCount) { this.potholesCount = potholesCount; }
    public long getCracksCount() { return cracksCount; }
    public void setCracksCount(long cracksCount) { this.cracksCount = cracksCount; }
    public long getTotalComplaints() { return totalComplaints; }
    public void setTotalComplaints(long totalComplaints) { this.totalComplaints = totalComplaints; }
    public long getSimulatedComplaints() { return simulatedComplaints; }
    public void setSimulatedComplaints(long simulatedComplaints) { this.simulatedComplaints = simulatedComplaints; }
}
