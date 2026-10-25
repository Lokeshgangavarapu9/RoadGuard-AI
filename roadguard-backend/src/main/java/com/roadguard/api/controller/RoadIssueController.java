package com.roadguard.api.controller;

import com.roadguard.api.dto.InvestigationResponse;
import com.roadguard.api.dto.RoadIssueResponse;
import com.roadguard.api.entity.EvidenceFrame;
import com.roadguard.api.entity.InvestigationResult;
import com.roadguard.api.entity.RoadIssue;
import com.roadguard.api.repository.EvidenceFrameRepository;
import com.roadguard.api.repository.InvestigationResultRepository;
import com.roadguard.api.repository.RoadIssueRepository;
import com.roadguard.api.service.InvestigationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/issues")
@SuppressWarnings("null")
public class RoadIssueController {

    private final RoadIssueRepository issueRepository;
    private final InvestigationResultRepository investigationRepository;
    private final EvidenceFrameRepository frameRepository;
    private final InvestigationService investigationService;

    public RoadIssueController(
        RoadIssueRepository issueRepository,
        InvestigationResultRepository investigationRepository,
        EvidenceFrameRepository frameRepository,
        InvestigationService investigationService
    ) {
        this.issueRepository = issueRepository;
        this.investigationRepository = investigationRepository;
        this.frameRepository = frameRepository;
        this.investigationService = investigationService;
    }

    @GetMapping
    public ResponseEntity<List<RoadIssueResponse>> listIssues(
        @RequestParam(required = false) Long journeyId,
        @RequestParam(required = false) RoadIssue.IssueStatus status
    ) {
        List<RoadIssue> issues;
        if (journeyId != null) {
            issues = issueRepository.findByJourneyId(journeyId);
        } else if (status != null) {
            issues = issueRepository.findByStatus(status);
        } else {
            issues = issueRepository.findAllByOrderByCreatedAtDesc();
        }

        List<RoadIssueResponse> responses = issues.stream()
            .map(this::mapIssueWithDetails)
            .collect(Collectors.toList());

        return ResponseEntity.ok(responses);
    }

    @GetMapping("/{id}")
    public ResponseEntity<RoadIssueResponse> getIssue(@PathVariable Long id) {
        RoadIssue issue = issueRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("RoadIssue not found: " + id));

        return ResponseEntity.ok(mapIssueWithDetails(issue));
    }

    @PostMapping("/{id}/investigate")
    public ResponseEntity<InvestigationResponse> investigateIssue(@PathVariable Long id) {
        RoadIssue issue = issueRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("RoadIssue not found: " + id));

        InvestigationResult ir = investigationService.investigateIssue(issue);
        return ResponseEntity.ok(InvestigationResponse.fromEntity(ir));
    }

    @GetMapping("/{id}/investigation")
    public ResponseEntity<InvestigationResponse> getInvestigation(@PathVariable Long id) {
        InvestigationResult ir = investigationRepository.findByRoadIssueId(id)
            .orElseThrow(() -> new IllegalArgumentException("Investigation not found for issue: " + id));

        return ResponseEntity.ok(InvestigationResponse.fromEntity(ir));
    }

    private RoadIssueResponse mapIssueWithDetails(RoadIssue issue) {
        RoadIssueResponse r = RoadIssueResponse.fromEntity(issue);

        Optional<InvestigationResult> irOpt = investigationRepository.findByRoadIssueId(issue.getId());
        if (irOpt.isPresent()) {
            InvestigationResult ir = irOpt.get();
            if (ir.getCandidateAuthority() != null) {
                r.setAuthorityCode(ir.getCandidateAuthority().getDeptCode());
                r.setAuthorityName(ir.getCandidateAuthority().getDeptName());
            }
            r.setDlpApplicable(ir.getDlpApplicable());
            r.setEvidenceTier(ir.getEvidenceTier());
        }

        // Locate representative frame for preview
        List<EvidenceFrame> frames = frameRepository.findByJourneyIdOrderByFrameSequenceAsc(issue.getJourney().getId());
        if (!frames.isEmpty()) {
            EvidenceFrame repFrame = frames.get(0);
            r.setRepresentativeFrameId(repFrame.getId());
            r.setRepresentativeFrameUrl("/uploads/" + repFrame.getStorageKey().replace("\\", "/"));
        }

        return r;
    }
}
