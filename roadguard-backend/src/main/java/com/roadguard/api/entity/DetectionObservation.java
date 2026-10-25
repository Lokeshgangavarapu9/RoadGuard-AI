package com.roadguard.api.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "detection_observations")
public class DetectionObservation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "frame_id", nullable = false)
    private EvidenceFrame frame;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "road_issue_id")
    private RoadIssue roadIssue;

    @Column(nullable = false, length = 50)
    private String rawClassLabel;

    @Column(nullable = false)
    private Double rawConfidence;

    @Column(name = "bbox_x1")
    private Double bboxX1;

    @Column(name = "bbox_y1")
    private Double bboxY1;

    @Column(name = "bbox_x2")
    private Double bboxX2;

    @Column(name = "bbox_y2")
    private Double bboxY2;

    @Column(nullable = false)
    private Boolean confirmed = false;

    private Integer confirmationFrame;

    @Column(nullable = false, length = 30)
    private String inferenceMode = "MOCK";

    @Column(nullable = false)
    private Instant detectedAt = Instant.now();

    public Long getId() { return id; }
    public EvidenceFrame getFrame() { return frame; }
    public void setFrame(EvidenceFrame frame) { this.frame = frame; }
    public RoadIssue getRoadIssue() { return roadIssue; }
    public void setRoadIssue(RoadIssue roadIssue) { this.roadIssue = roadIssue; }
    public String getRawClassLabel() { return rawClassLabel; }
    public void setRawClassLabel(String rawClassLabel) { this.rawClassLabel = rawClassLabel; }
    public Double getRawConfidence() { return rawConfidence; }
    public void setRawConfidence(Double rawConfidence) { this.rawConfidence = rawConfidence; }
    public Double getBboxX1() { return bboxX1; }
    public void setBboxX1(Double bboxX1) { this.bboxX1 = bboxX1; }
    public Double getBboxY1() { return bboxY1; }
    public void setBboxY1(Double bboxY1) { this.bboxY1 = bboxY1; }
    public Double getBboxX2() { return bboxX2; }
    public void setBboxX2(Double bboxX2) { this.bboxX2 = bboxX2; }
    public Double getBboxY2() { return bboxY2; }
    public void setBboxY2(Double bboxY2) { this.bboxY2 = bboxY2; }
    public Boolean getConfirmed() { return confirmed; }
    public void setConfirmed(Boolean confirmed) { this.confirmed = confirmed; }
    public Integer getConfirmationFrame() { return confirmationFrame; }
    public void setConfirmationFrame(Integer confirmationFrame) { this.confirmationFrame = confirmationFrame; }
    public String getInferenceMode() { return inferenceMode; }
    public void setInferenceMode(String inferenceMode) { this.inferenceMode = inferenceMode; }
    public Instant getDetectedAt() { return detectedAt; }
    public void setDetectedAt(Instant detectedAt) { this.detectedAt = detectedAt; }
}
