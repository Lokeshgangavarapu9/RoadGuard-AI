package com.roadguard.api.service;

import com.roadguard.api.dto.SimulateSubmissionResponse;
import com.roadguard.api.entity.AuthorityRecord;
import com.roadguard.api.entity.Complaint;
import com.roadguard.api.entity.InvestigationResult;
import com.roadguard.api.entity.RoadIssue;
import com.roadguard.api.repository.AuthorityRecordRepository;
import com.roadguard.api.repository.ComplaintRepository;
import com.roadguard.api.repository.InvestigationResultRepository;
import com.roadguard.api.repository.RoadIssueRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class ComplaintService {

    private static final Logger log = LoggerFactory.getLogger(ComplaintService.class);

    @Value("${roadguard.complaint.simulated-prefix:SIM-AP-PGRS-2026}")
    private String simulatedPrefix;

    @Value("${roadguard.complaint.simulated-warning:SIMULATED DEMONSTRATION — NOT SUBMITTED TO ANY GOVERNMENT AUTHORITY}")
    private String simulatedWarning;

    private final ComplaintRepository complaintRepository;
    private final RoadIssueRepository roadIssueRepository;
    private final AuthorityRecordRepository authorityRepository;
    private final InvestigationResultRepository investigationRepository;
    private final NotificationService notificationService;

    public ComplaintService(
        ComplaintRepository complaintRepository,
        RoadIssueRepository roadIssueRepository,
        AuthorityRecordRepository authorityRepository,
        InvestigationResultRepository investigationRepository,
        NotificationService notificationService
    ) {
        this.complaintRepository = complaintRepository;
        this.roadIssueRepository = roadIssueRepository;
        this.authorityRepository = authorityRepository;
        this.investigationRepository = investigationRepository;
        this.notificationService = notificationService;
    }

    /**
     * Auto-draft a comprehensive, legally-grounded complaint for a road issue.
     */
    @Transactional
    public Complaint autoDraftComplaint(Long roadIssueId, String complainantName, String complainantEmail, String complainantPhone) {
        RoadIssue issue = roadIssueRepository.findById(roadIssueId)
            .orElseThrow(() -> new IllegalArgumentException("RoadIssue not found: " + roadIssueId));

        InvestigationResult ir = investigationRepository.findByRoadIssueId(roadIssueId)
            .orElse(null);

        AuthorityRecord authority = ir != null ? ir.getCandidateAuthority() : null;
        if (authority == null) {
            authority = authorityRepository.findByDeptCode("NHAI").orElse(null);
        }

        String subject = String.format("URGENT: Hazardous Road Defect (%s) on %s - Action Requested",
            issue.getDefectClass().name().replace("_", " "),
            issue.getRoadName() != null ? issue.getRoadName() : "Public Highway");

        StringBuilder body = new StringBuilder();
        body.append("TO:\n");
        body.append("The Competent Authority / Grievance Redressal Officer,\n");
        body.append(authority != null ? authority.getDeptName() : "Department of Roads & Transport").append("\n");
        if (authority != null && authority.getJurisdiction() != null) {
            body.append("Jurisdiction: ").append(authority.getJurisdiction()).append("\n");
        }
        body.append("\n");

        body.append("SUBJECT: ").append(subject).append("\n\n");

        body.append("RESPECTED SIR / MADAM,\n\n");
        body.append("I am writing to formally report an active, hazardous road defect detected during vehicular travel and logged with automated sensor evidence via the RoadGuard AI system.\n\n");

        body.append("1. DEFECT LOCATION & DETAILS:\n");
        body.append("   • Defect Classification: ").append(issue.getDefectClass()).append("\n");
        body.append("   • Severity Assessment:   ").append(issue.getSeverity()).append("\n");
        body.append("   • GPS Coordinates:       ").append(String.format("%.6f, %.6f", issue.getLatitude(), issue.getLongitude())).append("\n");
        body.append("   • Road / Corridor Name:  ").append(issue.getRoadName() != null ? issue.getRoadName() : "Unspecified").append("\n");
        body.append("   • Address Description:   ").append(issue.getAddress() != null ? issue.getAddress() : "Andhra Pradesh").append("\n");
        body.append("   • First Detected:        ").append(issue.getFirstSeenAt()).append("\n");
        body.append("   • Observation Count:     ").append(issue.getObservationCount()).append(" confirmed camera passes\n\n");

        body.append("2. STATUTORY JURISDICTION & CITATIONS:\n");
        if (ir != null && Boolean.TRUE.equals(ir.getDlpApplicable()) && ir.getDlpContractor() != null) {
            body.append("   • [DEFECT LIABILITY PERIOD NOTICE]:\n");
            body.append("     According to official tender records, this stretch is subject to active Defect Liability until ")
                .append(ir.getDlpEndDate()).append(" under Contractor: '").append(ir.getDlpContractor().getContractorName())
                .append("' (Tender Package: ").append(ir.getDlpContractor().getPackageNumber()).append(").\n");
            body.append("     Under standard PWD/MoRTH contract conditions, the contractor is legally bound to repair this defect at zero public expense within 48 hours.\n");
        } else {
            body.append("   • Standard Maintenance Jurisdiction: ").append(authority != null ? authority.getDeptCode() : "Competent Authority").append("\n");
            body.append("   • Reference IRC:82-2015 / IRC:SP:84 Guidelines for Maintenance of Road Infrastructure.\n");
            body.append("   • Potholes and transverse cracks of this magnitude constitute immediate threats to two-wheeler riders and road safety under Section 133 of the Code of Criminal Procedure (Public Nuisance & Safety).\n");
        }
        body.append("\n");

        body.append("3. REQUESTED RELIEF:\n");
        body.append("   1. Immediate temporary cold-mix patch or barricading within 24 hours to avert fatal accidents.\n");
        body.append("   2. Permanent structural bituminous/concrete restoration as per IRC specifications.\n");
        body.append("   3. Written confirmation and grievance reference number communicated to complainant.\n\n");

        body.append("Complainant Name: ").append(complainantName != null ? complainantName : "Concerned Citizen / Commuter").append("\n");
        body.append("Complainant Contact: ").append(complainantEmail != null ? complainantEmail : "Not provided").append("\n");
        body.append("Logged via: RoadGuard AI Mobile Road Safety Platform\n");

        Complaint complaint = new Complaint();
        complaint.setUuid(UUID.randomUUID().toString());
        complaint.setRoadIssue(issue);
        complaint.setAuthority(authority);
        complaint.setSubject(subject);
        complaint.setBodyText(body.toString());
        complaint.setComplainantName(complainantName);
        complaint.setComplainantEmail(complainantEmail);
        complaint.setComplainantPhone(complainantPhone);
        complaint.setStatus(Complaint.ComplaintStatus.DRAFT);
        complaint.setSubmissionStage("A");

        issue.setStatus(RoadIssue.IssueStatus.COMPLAINT_DRAFTED);
        roadIssueRepository.save(issue);

        Complaint saved = complaintRepository.save(complaint);
        log.info("Auto-drafted complaint #{} for issue #{}", saved.getId(), issue.getId());
        return saved;
    }

    /**
     * Stage A: Simulate complaint submission with clear regulatory disclaimer and watermark.
     */
    @Transactional
    public SimulateSubmissionResponse simulateSubmission(Long complaintId) {
        Complaint complaint = complaintRepository.findById(complaintId)
            .orElseThrow(() -> new IllegalArgumentException("Complaint not found: " + complaintId));

        int randomNum = ThreadLocalRandom.current().nextInt(10000, 99999);
        String refId = String.format("%s-%05d", simulatedPrefix, randomNum);
        Instant now = Instant.now();

        complaint.setStatus(Complaint.ComplaintStatus.SIMULATED);
        complaint.setSimulatedRefId(refId);
        complaint.setSimulatedAt(now);
        complaint.setSimulatedWarning(simulatedWarning);
        complaintRepository.save(complaint);

        // Update issue status
        RoadIssue issue = complaint.getRoadIssue();
        issue.setStatus(RoadIssue.IssueStatus.COMPLAINT_SUBMITTED);
        roadIssueRepository.save(issue);

        AuthorityRecord authority = complaint.getAuthority();

        StringBuilder receipt = new StringBuilder();
        receipt.append("=================================================================\n");
        receipt.append("      ROADGUARD AI — SIMULATED GRIEVANCE SUBMISSION RECEIPT      \n");
        receipt.append("=================================================================\n");
        receipt.append("[WARNING]: ").append(simulatedWarning).append("\n");
        receipt.append("-----------------------------------------------------------------\n");
        receipt.append("SIMULATED REFERENCE ID : ").append(refId).append("\n");
        receipt.append("TIMESTAMP              : ").append(DateTimeFormatter.ISO_INSTANT.format(now)).append("\n");
        receipt.append("TARGET AUTHORITY       : ").append(authority != null ? authority.getDeptName() : "NHAI").append("\n");
        receipt.append("OFFICIAL PORTAL        : ").append(authority != null ? authority.getGrievanceUrl() : "https://pgr.ap.gov.in").append("\n");
        receipt.append("COMPLAINANT            : ").append(complaint.getComplainantName()).append(" (").append(complaint.getComplainantEmail()).append(")\n");
        receipt.append("ISSUE REF              : #").append(issue.getId()).append(" - ").append(issue.getDefectClass()).append(" at ").append(issue.getRoadName()).append("\n");
        receipt.append("SUBMISSION STATUS      : STAGE A SIMULATED (DEMO MODE)\n");
        receipt.append("-----------------------------------------------------------------\n");
        receipt.append("In Stage B/C, this action triggers assisted filing to Andhra Pradesh\n");
        receipt.append("Spandana / PGRS or NHAI Rajmarg Yatra with citizen OTP authorization.\n");
        receipt.append("=================================================================\n");

        SimulateSubmissionResponse resp = new SimulateSubmissionResponse();
        resp.setSimulatedRefId(refId);
        resp.setStatus("SIMULATED");
        resp.setSimulatedAt(now);
        resp.setWarningWatermark(simulatedWarning);
        resp.setAuthorityDeptCode(authority != null ? authority.getDeptCode() : "NHAI");
        resp.setAuthorityDeptName(authority != null ? authority.getDeptName() : "National Highways Authority of India");
        resp.setGrievancePortalUrl(authority != null ? authority.getGrievanceUrl() : "https://pgr.ap.gov.in");
        resp.setReceiptText(receipt.toString());

        // Send confirmation email / notification event
        notificationService.notifyComplaintSimulated(complaint, resp);

        return resp;
    }
}
