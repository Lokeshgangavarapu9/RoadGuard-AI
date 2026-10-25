package com.roadguard.api.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "event_grouping_audit")
public class EventGroupingAudit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "group_uuid", nullable = false, length = 36)
    private String groupUuid;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "road_issue_id", nullable = false)
    private RoadIssue roadIssue;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "frame_id")
    private EvidenceFrame frame;

    @Column(name = "spatial_distance_m")
    private Double spatialDistanceM;

    @Column(name = "heading_delta_deg")
    private Double headingDeltaDeg;

    @Column(name = "temporal_delta_seconds")
    private Double temporalDeltaSeconds;

    @Column(name = "best_evidence_score")
    private Double bestEvidenceScore;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public String getGroupUuid() { return groupUuid; }
    public void setGroupUuid(String groupUuid) { this.groupUuid = groupUuid; }
    public RoadIssue getRoadIssue() { return roadIssue; }
    public void setRoadIssue(RoadIssue roadIssue) { this.roadIssue = roadIssue; }
    public EvidenceFrame getFrame() { return frame; }
    public void setFrame(EvidenceFrame frame) { this.frame = frame; }
    public Double getSpatialDistanceM() { return spatialDistanceM; }
    public void setSpatialDistanceM(Double spatialDistanceM) { this.spatialDistanceM = spatialDistanceM; }
    public Double getHeadingDeltaDeg() { return headingDeltaDeg; }
    public void setHeadingDeltaDeg(Double headingDeltaDeg) { this.headingDeltaDeg = headingDeltaDeg; }
    public Double getTemporalDeltaSeconds() { return temporalDeltaSeconds; }
    public void setTemporalDeltaSeconds(Double temporalDeltaSeconds) { this.temporalDeltaSeconds = temporalDeltaSeconds; }
    public Double getBestEvidenceScore() { return bestEvidenceScore; }
    public void setBestEvidenceScore(Double bestEvidenceScore) { this.bestEvidenceScore = bestEvidenceScore; }
    public Instant getCreatedAt() { return createdAt; }
}
