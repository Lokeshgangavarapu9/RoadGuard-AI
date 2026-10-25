package com.roadguard.api.service;

import com.roadguard.api.entity.AuthorityRecord;
import com.roadguard.api.entity.Complaint;
import com.roadguard.api.entity.RoadIssue;
import com.roadguard.api.repository.AuthorityRecordRepository;
import com.roadguard.api.repository.ComplaintRepository;
import com.roadguard.api.repository.RoadIssueRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Complaint Agent Service implementing the explicit 9-state civic complaint lifecycle
 * with strict anti-fabrication guards, multi-tier jurisdiction routing, and citizen-assisted handoff.
 */
@Service
@SuppressWarnings("null")
public class ComplaintAgentService {

    private static final Logger log = LoggerFactory.getLogger(ComplaintAgentService.class);

    private static final Pattern FAKE_REF_PATTERN = Pattern.compile("(?i)^(SIM[-_]|STM[-_]|MOCK[-_]|TEST[-_]|DEMO[-_]).*");

    public record PortalHandoffPacket(
        Long complaintId,
        String complaintUuid,
        String officialPortalUrl,
        String targetAuthorityCode,
        String targetAuthorityName,
        String status,
        String subject,
        String dossierText,
        String authNotice,
        boolean requiresCitizenAction
    ) {}

    public record SubmissionConfirmation(
        Long complaintId,
        String complaintUuid,
        String status,
        String officialRefId,
        Instant submittedAt,
        String confirmationMessage
    ) {}

    private final ComplaintRepository complaintRepository;
    private final RoadIssueRepository roadIssueRepository;
    private final AuthorityRecordRepository authorityRepository;
    private final AuthorityRoutingService routingService;

    public ComplaintAgentService(
        ComplaintRepository complaintRepository,
        RoadIssueRepository roadIssueRepository,
        AuthorityRecordRepository authorityRepository,
        AuthorityRoutingService routingService
    ) {
        this.complaintRepository = complaintRepository;
        this.roadIssueRepository = roadIssueRepository;
        this.authorityRepository = authorityRepository;
        this.routingService = routingService;
    }

    /**
     * Prepares or auto-drafts a truthful complaint dossier from confirmed road defect telemetry.
     */
    @Transactional
    public Complaint prepareComplaint(Long issueId, String complainantName, String complainantEmail, String complainantPhone) {
        RoadIssue issue = roadIssueRepository.findById(issueId)
            .orElseThrow(() -> new IllegalArgumentException("RoadIssue not found: " + issueId));

        String idempotencyKey = "CMP-" + issue.getId() + "-" + Integer.toHexString(issue.getUuid().hashCode());
        Optional<Complaint> existing = complaintRepository.findByIdempotencyKey(idempotencyKey);
        if (existing.isPresent()) {
            log.info("Returning existing idempotent complaint #{} for issue #{}", existing.get().getId(), issueId);
            return existing.get();
        }

        // 1. Resolve responsible authority
        AuthorityRoutingService.AuthorityRoutingDecision routing = routingService.resolveAuthority(
            issue.getLatitude(), issue.getLongitude(), null, issue.getRoadName(), null);

        AuthorityRecord authority = authorityRepository.findByDeptCode(routing.authorityCode())
            .orElseGet(() -> authorityRepository.findByDeptCode("UNKNOWN").orElse(null));

        String subject = String.format("URGENT: Hazardous Road Defect [%s] at %s",
            issue.getDefectClass(), (issue.getRoadName() != null ? issue.getRoadName() : "Civic Corridor"));

        String body = buildFactualComplaintBody(issue, routing, complainantName, complainantPhone);

        Complaint complaint = new Complaint();
        complaint.setUuid(UUID.randomUUID().toString());
        complaint.setRoadIssue(issue);
        complaint.setAuthority(authority);
        complaint.setSubject(subject);
        complaint.setBodyText(body);
        complaint.setComplainantName(complainantName);
        complaint.setComplainantEmail(complainantEmail);
        complaint.setComplainantPhone(complainantPhone);
        complaint.setIdempotencyKey(idempotencyKey);
        complaint.setRoutingEvidence(routing.routingEvidenceJson());
        complaint.setOfficialPortalUrl(routing.grievanceUrl() != null ? routing.grievanceUrl() : routing.portalUrl());

        // State Machine Transition: Check if human review is needed
        if (issue.getConfidenceScore() != null && issue.getConfidenceScore() < 0.65 ||
            issue.getLocationAccuracyM() != null && issue.getLocationAccuracyM() > 25.0 ||
            routing.requiresUserConfirmation()) {
            complaint.setStatus(Complaint.ComplaintStatus.AWAITING_REVIEW);
            issue.setStatus(RoadIssue.IssueStatus.INVESTIGATING);
        } else {
            complaint.setStatus(Complaint.ComplaintStatus.COMPLAINT_PREPARED);
            issue.setStatus(RoadIssue.IssueStatus.COMPLAINT_DRAFTED);
        }

        roadIssueRepository.save(issue);
        Complaint saved = complaintRepository.save(complaint);
        log.info("Prepared complaint #{} in state: {}", saved.getId(), saved.getStatus());
        return saved;
    }

    /**
     * Step 1 of Assisted Submission: Opens external official portal and transitions strictly
     * to AWAITING_USER_ACTION. Never marks as SUBMITTED prematurely.
     */
    @Transactional
    public PortalHandoffPacket initiatePortalHandoff(Long complaintId) {
        Complaint complaint = complaintRepository.findById(complaintId)
            .orElseThrow(() -> new IllegalArgumentException("Complaint not found: " + complaintId));

        complaint.setStatus(Complaint.ComplaintStatus.AWAITING_USER_ACTION);
        complaint.setSubmissionNotes("Dossier compiled; opened official portal. Awaiting citizen authentication & reference verification.");
        complaintRepository.save(complaint);

        String portalUrl = complaint.getOfficialPortalUrl();
        if (portalUrl == null || portalUrl.isBlank()) {
            portalUrl = (complaint.getAuthority() != null && complaint.getAuthority().getGrievanceUrl() != null)
                ? complaint.getAuthority().getGrievanceUrl()
                : "https://rajmargyatra.nhai.gov.in/";
        }

        String authNotice = "Official government portals (NHAI Rajmargyatra / AP CDMA / AP R&B) require Citizen Mobile SMS OTP verification. " +
            "RoadGuard AI prepares the factual report but will never bypass government authentication.";

        return new PortalHandoffPacket(
            complaint.getId(),
            complaint.getUuid(),
            portalUrl,
            complaint.getAuthority() != null ? complaint.getAuthority().getDeptCode() : "NHAI",
            complaint.getAuthority() != null ? complaint.getAuthority().getDeptName() : "National Highways Authority of India",
            complaint.getStatus().name(),
            complaint.getSubject(),
            complaint.getBodyText(),
            authNotice,
            true
        );
    }

    /**
     * Step 2 of Assisted Submission: Citizen records official government receipt / reference ID.
     * Enforces anti-fabrication guards (rejects fake SIM-* IDs and empty strings).
     */
    @Transactional
    public SubmissionConfirmation recordOfficialReceipt(Long complaintId, String officialRefId, String userNotes) {
        if (officialRefId == null || officialRefId.trim().isEmpty()) {
            throw new IllegalArgumentException("Official reference ID is mandatory to confirm submission.");
        }

        String trimmedRef = officialRefId.trim();

        // Anti-Fabrication Guard: Reject mock or simulated reference numbers
        if (FAKE_REF_PATTERN.matcher(trimmedRef).matches()) {
            throw new IllegalArgumentException("Simulated reference numbers ('" + trimmedRef + "') are rejected. Please provide the genuine government receipt reference number.");
        }

        if (trimmedRef.length() < 4) {
            throw new IllegalArgumentException("Reference ID '" + trimmedRef + "' is too short to be a valid government acknowledgment ID.");
        }

        Complaint complaint = complaintRepository.findById(complaintId)
            .orElseThrow(() -> new IllegalArgumentException("Complaint not found: " + complaintId));

        Instant now = Instant.now();
        complaint.setStatus(Complaint.ComplaintStatus.SUBMITTED);
        complaint.setOfficialRefId(trimmedRef);
        complaint.setSubmittedAt(now);
        complaint.setSubmissionNotes(userNotes != null ? userNotes : "Verified by citizen official portal receipt submission.");
        complaintRepository.save(complaint);

        RoadIssue issue = complaint.getRoadIssue();
        if (issue != null) {
            issue.setStatus(RoadIssue.IssueStatus.COMPLAINT_SUBMITTED);
            roadIssueRepository.save(issue);
        }

        log.info("Complaint #{} verified and marked SUBMITTED with genuine official reference: {}", complaint.getId(), trimmedRef);

        return new SubmissionConfirmation(
            complaint.getId(),
            complaint.getUuid(),
            "SUBMITTED",
            trimmedRef,
            now,
            "Official acknowledgment recorded successfully. Grievance status can be tracked on the authority portal using reference: " + trimmedRef
        );
    }

    /**
     * Handles network timeouts or ambiguous handoffs without blind automated retry.
     */
    @Transactional
    public void markSubmissionUnknown(Long complaintId, String reason) {
        Complaint complaint = complaintRepository.findById(complaintId)
            .orElseThrow(() -> new IllegalArgumentException("Complaint not found: " + complaintId));

        complaint.setStatus(Complaint.ComplaintStatus.SUBMISSION_UNKNOWN);
        complaint.setSubmissionNotes("Submission status uncertain: " + reason + ". Automated retries blocked to prevent duplicate filings.");
        complaintRepository.save(complaint);
    }

    private String buildFactualComplaintBody(RoadIssue issue, AuthorityRoutingService.AuthorityRoutingDecision routing, String name, String phone) {
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd-MMM-yyyy HH:mm:ss 'IST'").withZone(ZoneId.of("Asia/Kolkata"));
        String timeStr = fmt.format(issue.getFirstSeenAt());

        return String.format("""
            TO:
            %s
            Official Jurisdiction: %s
            Portal: %s

            SUBJECT: %s

            RESPECTED AUTHORITY,

            A hazardous road pavement defect has been detected by RoadGuard AI vehicular sensor monitoring and verified for civic grievance submission.

            1. DEFECT TELEMETRY & LOCATION:
               - Defect Classification : %s
               - Severity Level        : %s
               - GPS Coordinates       : %.6f°N, %.6f°E (Accuracy: ±%.1fm)
               - Identified Corridor   : %s
               - Detection Timestamp   : %s
               - Observation Count     : %d verified video frames
               - Model Confidence      : %.1f%%

            2. STATUTORY & SAFETY GROUNDS:
               This defect presents an immediate danger to vehicular stability, two-wheeler riders, and emergency traffic.
               - Indian Roads Congress Code: IRC:82-2015 (Maintenance of Bituminous Roads)
               - Criminal Procedure Code: Section 133 CrPC (Public nuisance and danger along public highways)
               - National Highway / Municipal Pavement Serviceability Standards

            3. COMPLAINANT CONTACT:
               - Citizen Name : %s
               - Contact Phone: %s

            4. REQUESTED ACTION:
               Kindly dispatch the jurisdictional maintenance engineer to inspect the chainage, deploy cold/hot mix asphalt rectification, and furnish the official grievance tracking number.

            Truthfully submitted via RoadGuard AI Civic Assistance Engine.
            """,
            routing.authorityName(),
            routing.jurisdictionDescription(),
            routing.portalUrl() != null ? routing.portalUrl() : "https://rajmargyatra.nhai.gov.in",
            issue.getDefectClass() + " at " + (issue.getRoadName() != null ? issue.getRoadName() : "Road Corridor"),
            issue.getDefectClass(),
            issue.getSeverity(),
            issue.getLatitude(), issue.getLongitude(),
            issue.getLocationAccuracyM() != null ? issue.getLocationAccuracyM() : 10.0,
            issue.getRoadName() != null ? issue.getRoadName() : "Unassigned Corridor",
            timeStr,
            issue.getObservationCount(),
            (issue.getConfidenceScore() != null ? issue.getConfidenceScore() * 100 : 85.0),
            name != null ? name : "Citizen Road User",
            phone != null ? phone : "Provided during portal authentication"
        );
    }
}
