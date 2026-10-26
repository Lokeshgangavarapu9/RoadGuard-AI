package com.roadguard.api.controller;

import com.roadguard.api.dto.InvestigationResponse;
import com.roadguard.api.dto.RoadIssueResponse;
import com.roadguard.api.entity.EvidenceFrame;
import com.roadguard.api.entity.InvestigationResult;
import com.roadguard.api.entity.RoadIssue;
import com.roadguard.api.repository.EvidenceFrameRepository;
import com.roadguard.api.repository.InvestigationResultRepository;
import com.roadguard.api.repository.RoadIssueRepository;
import com.roadguard.api.service.AuthorityRoutingService;
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
    private final AuthorityRoutingService authorityRoutingService;

    public RoadIssueController(
        RoadIssueRepository issueRepository,
        InvestigationResultRepository investigationRepository,
        EvidenceFrameRepository frameRepository,
        InvestigationService investigationService,
        AuthorityRoutingService authorityRoutingService
    ) {
        this.issueRepository = issueRepository;
        this.investigationRepository = investigationRepository;
        this.frameRepository = frameRepository;
        this.investigationService = investigationService;
        this.authorityRoutingService = authorityRoutingService;
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

    public static class ManualLocationRequest {
        private String roadName;
        private String cityOrTown;
        private String district;
        private String state;
        private String pincode;
        private Double latitude;
        private Double longitude;

        public String getRoadName() { return roadName; }
        public void setRoadName(String roadName) { this.roadName = roadName; }
        public String getCityOrTown() { return cityOrTown; }
        public void setCityOrTown(String cityOrTown) { this.cityOrTown = cityOrTown; }
        public String getDistrict() { return district; }
        public void setDistrict(String district) { this.district = district; }
        public String getState() { return state; }
        public void setState(String state) { this.state = state; }
        public String getPincode() { return pincode; }
        public void setPincode(String pincode) { this.pincode = pincode; }
        public Double getLatitude() { return latitude; }
        public void setLatitude(Double latitude) { this.latitude = latitude; }
        public Double getLongitude() { return longitude; }
        public void setLongitude(Double longitude) { this.longitude = longitude; }
    }

    @PutMapping("/{id}/location")
    public ResponseEntity<RoadIssueResponse> updateManualLocation(
        @PathVariable Long id,
        @RequestBody ManualLocationRequest req
    ) {
        RoadIssue issue = issueRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("RoadIssue not found: " + id));

        // Coordinate range validation
        if (req.getLatitude() != null && (req.getLatitude() < -90.0 || req.getLatitude() > 90.0)) {
            throw new IllegalArgumentException("Latitude must be between -90.0 and 90.0");
        }
        if (req.getLongitude() != null && (req.getLongitude() < -180.0 || req.getLongitude() > 180.0)) {
            throw new IllegalArgumentException("Longitude must be between -180.0 and 180.0");
        }

        if (req.getRoadName() != null && !req.getRoadName().isBlank()) {
            issue.setRoadName(req.getRoadName().trim());
        }
        if (req.getCityOrTown() != null) issue.setCityOrTown(req.getCityOrTown().trim());
        if (req.getDistrict() != null) issue.setDistrict(req.getDistrict().trim());
        if (req.getState() != null) issue.setState(req.getState().trim());
        if (req.getPincode() != null) issue.setPincode(req.getPincode().trim());

        if (req.getLatitude() != null && req.getLongitude() != null) {
            issue.setLatitude(req.getLatitude());
            issue.setLongitude(req.getLongitude());
            issue.setLocationAccuracyM(15.0); // manual estimated accuracy
        }

        issue.setLocationSource("MANUAL_ENTRY");

        // Construct readable address
        StringBuilder sb = new StringBuilder();
        if (issue.getRoadName() != null && !issue.getRoadName().isBlank()) sb.append(issue.getRoadName());
        if (issue.getCityOrTown() != null && !issue.getCityOrTown().isBlank()) {
            if (sb.length() > 0) sb.append(", ");
            sb.append(issue.getCityOrTown());
        }
        if (issue.getDistrict() != null && !issue.getDistrict().isBlank()) {
            if (sb.length() > 0) sb.append(", ");
            sb.append(issue.getDistrict());
        }
        if (issue.getState() != null && !issue.getState().isBlank()) {
            if (sb.length() > 0) sb.append(", ");
            sb.append(issue.getState());
        }
        if (issue.getPincode() != null && !issue.getPincode().isBlank()) {
            if (sb.length() > 0) sb.append(" - ");
            sb.append(issue.getPincode());
        }
        if (sb.length() > 0) {
            issue.setAddress(sb.toString());
        }

        // Re-resolve authority routing with manual inputs
        AuthorityRoutingService.AuthorityRoutingDecision routing = authorityRoutingService.resolveAuthority(
            issue.getLatitude(), issue.getLongitude(), null, issue.getRoadName(), null);

        // Update issue status if it was previously blocked on MANUAL_LOCATION_REQUIRED
        if (issue.getStatus() == RoadIssue.IssueStatus.INVESTIGATING &&
            (issue.getNotes() != null && issue.getNotes().contains("Location missing"))) {
            issue.setStatus(RoadIssue.IssueStatus.DETECTED);
            issue.setNotes("Location manually provided by citizen");
        }

        RoadIssue saved = issueRepository.save(issue);
        try {
            investigationService.investigateIssue(saved);
        } catch (Exception e) {
            // non-fatal
        }

        return ResponseEntity.ok(mapIssueWithDetails(saved));
    }
}
