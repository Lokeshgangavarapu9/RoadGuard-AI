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

import com.roadguard.api.dto.ConfirmedComplaintResponse;
import com.roadguard.api.entity.AutomationJob;
import com.roadguard.api.entity.EvidenceFrame;
import com.roadguard.api.repository.AutomationJobRepository;
import com.roadguard.api.repository.EvidenceFrameRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/complaints")
@SuppressWarnings("null")
public class ComplaintController {

    private static final Pattern MOCK_REF_PATTERN = Pattern.compile("(?i)^(MOCK[-_]|SIM[-_]|TEST[-_]|DEMO[-_]|STM[-_]|DRAFT[-_]).*");

    private final ComplaintAgentService complaintAgentService;
    private final ComplaintRepository complaintRepository;
    private final RoadIssueRepository roadIssueRepository;
    private final AuthorityRecordRepository authorityRepository;
    private final AutomationJobRepository automationJobRepository;
    private final EvidenceFrameRepository evidenceFrameRepository;

    public ComplaintController(
        ComplaintAgentService complaintAgentService,
        ComplaintRepository complaintRepository,
        RoadIssueRepository roadIssueRepository,
        AuthorityRecordRepository authorityRepository,
        AutomationJobRepository automationJobRepository,
        EvidenceFrameRepository evidenceFrameRepository
    ) {
        this.complaintAgentService = complaintAgentService;
        this.complaintRepository = complaintRepository;
        this.roadIssueRepository = roadIssueRepository;
        this.authorityRepository = authorityRepository;
        this.automationJobRepository = automationJobRepository;
        this.evidenceFrameRepository = evidenceFrameRepository;
    }

    /**
     * Retrieves the truthful audit history of confirmed government complaints.
     *
     * <p>Anti-Fabrication & Strict Separation Rule:
     * Excludes drafts, unapproved, pending worker jobs, SUBMISSION_UNVERIFIED,
     * failed submissions, and any MOCK/simulated filings.</p>
     */
    @GetMapping("/confirmed-history")
    public ResponseEntity<List<ConfirmedComplaintResponse>> getConfirmedComplaintsHistory() {
        List<Complaint> submitted = complaintRepository.findByStatusAndOfficialRefIdIsNotNullOrderBySubmittedAtDesc(Complaint.ComplaintStatus.SUBMITTED);
        List<ConfirmedComplaintResponse> history = new ArrayList<>();

        for (Complaint c : submitted) {
            String ref = c.getOfficialRefId();
            if (ref == null || ref.trim().length() < 3) {
                continue;
            }
            // Strict check: reject any mock or test reference prefixes
            if (MOCK_REF_PATTERN.matcher(ref.trim()).matches()) {
                continue;
            }

            // Check associated automation job if present
            var jobOpt = automationJobRepository.findFirstByComplaintIdOrderByCreatedAtDesc(c.getId());
            if (jobOpt.isPresent()) {
                AutomationJob job = jobOpt.get();
                // Strictly exclude jobs executed in MOCK mode
                if (job.getMode() == AutomationJob.AutomationMode.MOCK) {
                    continue;
                }
                // Strictly exclude jobs that did not reach verified COMPLETED status
                if (job.getStatus() != AutomationJob.JobStatus.COMPLETED) {
                    continue;
                }
                // Verify that the job's recorded reference matches the complaint's official receipt
                if (job.getOfficialReferenceNumber() == null || !job.getOfficialReferenceNumber().trim().equals(ref.trim())) {
                    continue;
                }
            }

            ConfirmedComplaintResponse resp = new ConfirmedComplaintResponse();
            resp.setComplaintId(c.getId());
            resp.setComplaintUuid(c.getUuid());
            resp.setOfficialRefId(ref.trim());
            resp.setSubmittedAt(c.getSubmittedAt() != null ? c.getSubmittedAt() : c.getUpdatedAt());

            // Portal details
            if (c.getAuthority() != null) {
                resp.setPortalName(c.getAuthority().getDeptName());
                String authUrl = c.getAuthority().getGrievanceUrl() != null ? c.getAuthority().getGrievanceUrl() : c.getAuthority().getPortalUrl();
                resp.setOfficialPortalUrl(authUrl);
            } else {
                resp.setPortalName("Government Grievance Portal");
                resp.setOfficialPortalUrl(c.getOfficialPortalUrl());
            }
            if (c.getOfficialPortalUrl() != null && !c.getOfficialPortalUrl().isBlank()) {
                resp.setOfficialPortalUrl(c.getOfficialPortalUrl());
            }

            // Road Issue and Journey Linkage
            RoadIssue issue = c.getRoadIssue();
            if (issue != null) {
                resp.setRoadIssueId(issue.getId());
                resp.setDefectCategory(issue.getDefectClass() != null ? issue.getDefectClass().name() : "POTHOLE");
                resp.setRoadName(issue.getRoadName() != null ? issue.getRoadName() : "Public Roadway");
                resp.setLatitude(issue.getLatitude());
                resp.setLongitude(issue.getLongitude());

                if (issue.getJourney() != null) {
                    resp.setJourneyId(issue.getJourney().getId());

                    // Retrieve evidence photos for linked journey
                    List<EvidenceFrame> frames = evidenceFrameRepository.findByJourneyIdOrderByFrameSequenceAsc(issue.getJourney().getId());
                    if (!frames.isEmpty()) {
                        List<String> urls = frames.stream()
                            .limit(4)
                            .map(f -> "/uploads/" + f.getStorageKey())
                            .collect(Collectors.toList());
                        resp.setEvidencePhotoUrls(urls);
                    }
                }
            }

            // Description text
            resp.setDescription(c.getSubject() != null ? c.getSubject() : "Confirmed road pavement defect complaint.");

            // Filing channel determination
            if (jobOpt.isPresent() && jobOpt.get().getStatus() == AutomationJob.JobStatus.COMPLETED) {
                resp.setFilingChannel("Automated Playwright Worker");
            } else {
                resp.setFilingChannel("Citizen Assisted Handoff");
            }

            history.add(resp);
        }

        return ResponseEntity.ok(history);
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
     * Citizen review approval: Transitions complaint to READY_TO_SUBMIT.
     */
    @PostMapping("/{id}/approve")
    public ResponseEntity<ComplaintResponse> approveComplaint(@PathVariable Long id) {
        Complaint approved = complaintAgentService.approveComplaint(id);
        return ResponseEntity.ok(ComplaintResponse.fromEntity(approved));
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
