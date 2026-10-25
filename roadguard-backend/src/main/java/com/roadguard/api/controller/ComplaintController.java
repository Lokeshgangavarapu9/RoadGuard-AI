package com.roadguard.api.controller;

import com.roadguard.api.dto.ComplaintResponse;
import com.roadguard.api.dto.CreateComplaintRequest;
import com.roadguard.api.dto.RecordReceiptRequest;
import com.roadguard.api.dto.SimulateSubmissionResponse;
import com.roadguard.api.entity.AuthorityRecord;
import com.roadguard.api.entity.Complaint;
import com.roadguard.api.entity.RoadIssue;
import com.roadguard.api.repository.AuthorityRecordRepository;
import com.roadguard.api.repository.ComplaintRepository;
import com.roadguard.api.repository.RoadIssueRepository;
import com.roadguard.api.service.ComplaintAgentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/complaints")
@SuppressWarnings("null")
public class ComplaintController {

    private final ComplaintAgentService complaintAgentService;
    private final ComplaintRepository complaintRepository;
    private final RoadIssueRepository roadIssueRepository;
    private final AuthorityRecordRepository authorityRepository;

    public ComplaintController(
        ComplaintAgentService complaintAgentService,
        ComplaintRepository complaintRepository,
        RoadIssueRepository roadIssueRepository,
        AuthorityRecordRepository authorityRepository
    ) {
        this.complaintAgentService = complaintAgentService;
        this.complaintRepository = complaintRepository;
        this.roadIssueRepository = roadIssueRepository;
        this.authorityRepository = authorityRepository;
    }

    @PostMapping("/auto-draft")
    public ResponseEntity<ComplaintResponse> autoDraft(
        @RequestParam Long issueId,
        @RequestParam(required = false) String complainantName,
        @RequestParam(required = false) String complainantEmail,
        @RequestParam(required = false) String complainantPhone
    ) {
        Complaint complaint = complaintAgentService.prepareComplaint(issueId, complainantName, complainantEmail, complainantPhone);
        return ResponseEntity.status(HttpStatus.CREATED).body(ComplaintResponse.fromEntity(complaint));
    }

    @PostMapping
    public ResponseEntity<ComplaintResponse> createComplaint(@Valid @RequestBody CreateComplaintRequest req) {
        RoadIssue issue = roadIssueRepository.findById(req.getRoadIssueId())
            .orElseThrow(() -> new IllegalArgumentException("RoadIssue not found: " + req.getRoadIssueId()));

        AuthorityRecord authority = null;
        if (req.getAuthorityId() != null) {
            authority = authorityRepository.findById(req.getAuthorityId()).orElse(null);
        }

        Complaint complaint = new Complaint();
        complaint.setUuid(UUID.randomUUID().toString());
        complaint.setRoadIssue(issue);
        complaint.setAuthority(authority);
        complaint.setSubject(req.getSubject());
        complaint.setBodyText(req.getBodyText());
        complaint.setComplainantName(req.getComplainantName());
        complaint.setComplainantEmail(req.getComplainantEmail());
        complaint.setComplainantPhone(req.getComplainantPhone());
        complaint.setStatus(Complaint.ComplaintStatus.COMPLAINT_PREPARED);
        complaint.setSubmissionStage("B");

        Complaint saved = complaintRepository.save(complaint);
        return ResponseEntity.status(HttpStatus.CREATED).body(ComplaintResponse.fromEntity(saved));
    }

    @GetMapping
    public ResponseEntity<List<ComplaintResponse>> listComplaints() {
        List<ComplaintResponse> list = complaintRepository.findAllByOrderByCreatedAtDesc().stream()
            .map(ComplaintResponse::fromEntity)
            .collect(Collectors.toList());
        return ResponseEntity.ok(list);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ComplaintResponse> getComplaint(@PathVariable Long id) {
        Complaint c = complaintRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Complaint not found: " + id));
        return ResponseEntity.ok(ComplaintResponse.fromEntity(c));
    }

    /**
     * Step 1: Citizen-assisted official portal handoff packet.
     */
    @PostMapping("/{id}/initiate-handoff")
    public ResponseEntity<ComplaintAgentService.PortalHandoffPacket> initiatePortalHandoff(@PathVariable Long id) {
        ComplaintAgentService.PortalHandoffPacket packet = complaintAgentService.initiatePortalHandoff(id);
        return ResponseEntity.ok(packet);
    }

    /**
     * Step 2: Record verified official government grievance reference ID.
     */
    @PostMapping("/{id}/record-receipt")
    public ResponseEntity<ComplaintAgentService.SubmissionConfirmation> recordOfficialReceipt(
        @PathVariable Long id,
        @Valid @RequestBody RecordReceiptRequest req
    ) {
        ComplaintAgentService.SubmissionConfirmation conf = complaintAgentService.recordOfficialReceipt(
            id, req.getOfficialRefId(), req.getNotes());
        return ResponseEntity.ok(conf);
    }

    /**
     * Backwards-compatible endpoint for legacy clients: Initiates truthful portal handoff
     * without generating fake reference IDs or mock receipts.
     */
    @PostMapping("/{id}/simulate")
    public ResponseEntity<SimulateSubmissionResponse> simulateSubmission(@PathVariable Long id) {
        ComplaintAgentService.PortalHandoffPacket packet = complaintAgentService.initiatePortalHandoff(id);
        SimulateSubmissionResponse resp = new SimulateSubmissionResponse();
        resp.setComplaintId(packet.complaintId());
        resp.setStatus("AWAITING_USER_ACTION");
        resp.setSimulatedRefId("AWAITING_PORTAL_RECEIPT");
        resp.setSimulatedAt(java.time.Instant.now());
        resp.setWarning("Official portal handoff initiated. Please complete OTP login on " + packet.targetAuthorityName() + " and record the returned official reference ID.");
        resp.setReceiptText(packet.dossierText());
        return ResponseEntity.ok(resp);
    }
}
