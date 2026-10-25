package com.roadguard.api.controller;

import com.roadguard.api.dto.HealthResponse;
import com.roadguard.api.dto.SystemStatsResponse;
import com.roadguard.api.entity.Complaint;
import com.roadguard.api.entity.Journey;
import com.roadguard.api.entity.RoadIssue;
import com.roadguard.api.repository.ComplaintRepository;
import com.roadguard.api.repository.EvidenceFrameRepository;
import com.roadguard.api.repository.JourneyRepository;
import com.roadguard.api.repository.RoadIssueRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class HealthController {

    @Value("${roadguard.inference.mode:MOCK}")
    private String inferenceMode;

    @Value("${roadguard.storage.type:local}")
    private String storageType;

    private final JourneyRepository journeyRepository;
    private final EvidenceFrameRepository frameRepository;
    private final RoadIssueRepository issueRepository;
    private final ComplaintRepository complaintRepository;
    private final com.roadguard.api.service.InferenceService inferenceService;

    public HealthController(
        JourneyRepository journeyRepository,
        EvidenceFrameRepository frameRepository,
        RoadIssueRepository issueRepository,
        ComplaintRepository complaintRepository,
        com.roadguard.api.service.InferenceService inferenceService
    ) {
        this.journeyRepository = journeyRepository;
        this.frameRepository = frameRepository;
        this.issueRepository = issueRepository;
        this.complaintRepository = complaintRepository;
        this.inferenceService = inferenceService;
    }

    @GetMapping("/health")
    public ResponseEntity<HealthResponse> getHealth() {
        HealthResponse h = new HealthResponse();
        h.setStatus("UP");
        h.setDatabase("H2_IN_MEMORY (Stage A)");
        h.setInferenceMode(inferenceService.getInferenceMode());
        h.setModelStatus(inferenceService.getModelStatus());
        h.setModelPath(inferenceService.getModelPath());
        h.setStorageType(storageType);
        return ResponseEntity.ok(h);
    }

    @GetMapping("/stats")
    public ResponseEntity<SystemStatsResponse> getStats() {
        SystemStatsResponse s = new SystemStatsResponse();
        s.setTotalJourneys(journeyRepository.count());
        s.setActiveJourneys(journeyRepository.findByStatus(Journey.JourneyStatus.ACTIVE).size());
        s.setTotalFrames(frameRepository.count());
        s.setTotalRoadIssues(issueRepository.count());
        s.setPotholesCount(issueRepository.countByDefectClass(RoadIssue.DefectClass.POTHOLE));
        s.setCracksCount(
            issueRepository.countByDefectClass(RoadIssue.DefectClass.ROAD_CRACK) +
            issueRepository.countByDefectClass(RoadIssue.DefectClass.ALLIGATOR_CRACK)
        );
        s.setTotalComplaints(complaintRepository.count());
        s.setSimulatedComplaints(complaintRepository.findByStatus(Complaint.ComplaintStatus.SIMULATED).size());
        return ResponseEntity.ok(s);
    }
}
