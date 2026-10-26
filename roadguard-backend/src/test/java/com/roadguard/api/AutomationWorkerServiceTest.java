package com.roadguard.api;

import com.roadguard.api.dto.AutomationJobDto;
import com.roadguard.api.dto.FilingAuditLogDto;
import com.roadguard.api.dto.WorkerCompleteRequest;
import com.roadguard.api.dto.WorkerEventRequest;
import com.roadguard.api.entity.AutomationJob;
import com.roadguard.api.entity.Complaint;
import com.roadguard.api.entity.Journey;
import com.roadguard.api.entity.RoadIssue;
import com.roadguard.api.repository.ComplaintRepository;
import com.roadguard.api.repository.JourneyRepository;
import com.roadguard.api.repository.RoadIssueRepository;
import com.roadguard.api.service.AutomationWorkerService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@SuppressWarnings("null")
class AutomationWorkerServiceTest {

    @Autowired
    private AutomationWorkerService automationWorkerService;

    @Autowired
    private ComplaintRepository complaintRepository;

    @Autowired
    private RoadIssueRepository roadIssueRepository;

    @Autowired
    private JourneyRepository journeyRepository;

    @Autowired
    private com.roadguard.api.repository.UserProfileRepository userProfileRepository;

    @Autowired
    private com.roadguard.api.repository.AutomationJobRepository automationJobRepository;

    private Complaint testComplaint;

    @BeforeEach
    void setUp() {
        Journey journey = new Journey();
        journey.setUuid(UUID.randomUUID().toString());
        journey.setRiderName("Citizen Tester");
        journey.setStatus(Journey.JourneyStatus.ACTIVE);
        journey = journeyRepository.save(journey);

        RoadIssue issue = new RoadIssue();
        issue.setUuid(UUID.randomUUID().toString());
        issue.setJourney(journey);
        issue.setLatitude(16.5062);
        issue.setLongitude(80.6480);
        issue.setRoadName("NH-16 Vijayawada Bypass");
        issue.setDefectClass(RoadIssue.DefectClass.POTHOLE);
        issue.setSeverity(RoadIssue.Severity.HIGH);
        issue.setConfidenceScore(0.88);
        issue = roadIssueRepository.save(issue);

        testComplaint = new Complaint();
        testComplaint.setUuid(UUID.randomUUID().toString());
        testComplaint.setRoadIssue(issue);
        testComplaint.setSubject("Hazardous Road Defect on NH-16");
        testComplaint.setBodyText("Factual telemetry description");
        testComplaint.setComplainantName("Citizen Tester");
        testComplaint.setComplainantPhone("+91 98765 43210");
        testComplaint.setStatus(Complaint.ComplaintStatus.AWAITING_CITIZEN_APPROVAL);
        testComplaint = complaintRepository.save(testComplaint);
    }

    @Test
    @DisplayName("Test full automation worker lifecycle with human-in-the-loop OTP/CAPTCHA handoffs")
    void testAutomationWorkerLifecycle() {
        // 1. Citizen approves & dispatches filing job
        AutomationJobDto jobDto = automationWorkerService.dispatchFilingJob(
            testComplaint.getId(), "MOCK_PORTAL", AutomationJob.AutomationMode.MOCK);

        assertNotNull(jobDto);
        assertEquals("PENDING", jobDto.status());
        assertEquals("MOCK_PORTAL", jobDto.portalId());

        Complaint refreshed = complaintRepository.findById(testComplaint.getId()).orElseThrow();
        assertEquals(Complaint.ComplaintStatus.SUBMITTING, refreshed.getStatus());

        // 2. Worker claims pending job
        List<AutomationJobDto> pending = automationWorkerService.getPendingJobs();
        assertFalse(pending.isEmpty());

        AutomationJobDto claimed = automationWorkerService.claimJob(jobDto.id(), "worker-test-1");
        assertEquals("RUNNING", claimed.status());
        assertEquals("worker-test-1", claimed.workerId());

        // 3. Worker encounters OTP challenge
        WorkerEventRequest otpReq = new WorkerEventRequest(
            "worker-test-1", "REQUEST_OTP", "AWAITING_HUMAN",
            "Government OTP required", "/screenshots/otp.png", "Enter SMS OTP", null);
        AutomationJobDto afterOtpReq = automationWorkerService.recordWorkerEvent(jobDto.id(), otpReq);

        assertEquals("AWAITING_OTP", afterOtpReq.status());
        refreshed = complaintRepository.findById(testComplaint.getId()).orElseThrow();
        assertEquals(Complaint.ComplaintStatus.AWAITING_CITIZEN, refreshed.getStatus());

        // 4. Citizen enters OTP in RoadGuard
        AutomationJobDto afterOtpSupplied = automationWorkerService.supplyOtp(jobDto.id(), "582914");
        assertEquals("RUNNING", afterOtpSupplied.status());
        refreshed = complaintRepository.findById(testComplaint.getId()).orElseThrow();
        assertEquals(Complaint.ComplaintStatus.SUBMITTING, refreshed.getStatus());

        // 5. Worker encounters CAPTCHA challenge
        WorkerEventRequest captchaReq = new WorkerEventRequest(
            "worker-test-1", "REQUEST_CAPTCHA", "AWAITING_HUMAN",
            "Government CAPTCHA required", "/screenshots/captcha.png", null, "Solve math puzzle");
        AutomationJobDto afterCaptchaReq = automationWorkerService.recordWorkerEvent(jobDto.id(), captchaReq);

        assertEquals("AWAITING_CAPTCHA", afterCaptchaReq.status());
        refreshed = complaintRepository.findById(testComplaint.getId()).orElseThrow();
        assertEquals(Complaint.ComplaintStatus.AWAITING_CITIZEN, refreshed.getStatus());

        // 6. Citizen solves CAPTCHA
        AutomationJobDto afterCaptchaSolved = automationWorkerService.confirmCaptchaSolved(jobDto.id());
        assertTrue(afterCaptchaSolved.captchaSolved());
        assertEquals("RUNNING", afterCaptchaSolved.status());

        // 7. Worker completes filing with genuine official reference number
        WorkerCompleteRequest completeReq = new WorkerCompleteRequest(
            "worker-test-1",
            "MOCK-NHAI-2026-984321",
            "Grievance officially registered with Executive Engineer NHAI",
            "/screenshots/ack.png",
            "COMPLETED"
        );
        AutomationJobDto completed = automationWorkerService.completeJob(jobDto.id(), completeReq);

        assertEquals("COMPLETED", completed.status());
        assertEquals("MOCK-NHAI-2026-984321", completed.officialReferenceNumber());

        refreshed = complaintRepository.findById(testComplaint.getId()).orElseThrow();
        assertEquals(Complaint.ComplaintStatus.SUBMITTED, refreshed.getStatus());
        assertEquals("MOCK-NHAI-2026-984321", refreshed.getOfficialRefId());
        assertNotNull(refreshed.getSubmittedAt());

        // 8. Verify audit logs
        List<FilingAuditLogDto> auditTrail = automationWorkerService.getAuditLogsForComplaint(testComplaint.getId());
        assertFalse(auditTrail.isEmpty());
        assertTrue(auditTrail.stream().anyMatch(l -> "DISPATCH_JOB".equals(l.action())));
        assertTrue(auditTrail.stream().anyMatch(l -> "REQUEST_OTP".equals(l.action())));
        assertTrue(auditTrail.stream().anyMatch(l -> "SUPPLY_OTP".equals(l.action())));
        assertTrue(auditTrail.stream().anyMatch(l -> "REQUEST_CAPTCHA".equals(l.action())));
        assertTrue(auditTrail.stream().anyMatch(l -> "CAPTCHA_SOLVED".equals(l.action())));
        assertTrue(auditTrail.stream().anyMatch(l -> "EXTRACT_REFERENCE".equals(l.action())));
    }

    @Test
    @DisplayName("Prevent duplicate job claiming by concurrent workers")
    void testConcurrentClaimPrevention() {
        AutomationJobDto jobDto = automationWorkerService.dispatchFilingJob(
            testComplaint.getId(), "MOCK_PORTAL", AutomationJob.AutomationMode.MOCK);

        AutomationJobDto claimed = automationWorkerService.claimJob(jobDto.id(), "worker-alpha");
        assertEquals("RUNNING", claimed.status());

        // Second worker trying to claim the same job must be rejected
        assertThrows(IllegalStateException.class, () -> {
            automationWorkerService.claimJob(jobDto.id(), "worker-beta");
        });
    }

    @Test
    @DisplayName("Verify SUBMISSION_UNVERIFIED state preservation on ambiguous portal response")
    void testSubmissionUnverifiedHandling() {
        AutomationJobDto jobDto = automationWorkerService.dispatchFilingJob(
            testComplaint.getId(), "MOCK_PORTAL", AutomationJob.AutomationMode.MOCK);

        automationWorkerService.claimJob(jobDto.id(), "worker-test-1");

        WorkerCompleteRequest unverifiedReq = new WorkerCompleteRequest(
            "worker-test-1",
            null,
            "Official receipt not detected before timeout. Preserving unverified state.",
            "/screenshots/timeout.png",
            "SUBMISSION_UNVERIFIED"
        );

        automationWorkerService.completeJob(jobDto.id(), unverifiedReq);

        Complaint refreshed = complaintRepository.findById(testComplaint.getId()).orElseThrow();
        assertEquals(Complaint.ComplaintStatus.SUBMISSION_UNVERIFIED, refreshed.getStatus());
        assertNull(refreshed.getOfficialRefId());
    }

    @Autowired
    private com.roadguard.api.controller.ComplaintController complaintController;

    @Test
    @DisplayName("Confirmed complaints history returns genuine submissions and strictly excludes mocks/unverified")
    void testConfirmedComplaintsHistoryExcludesMocksAndUnverified() {
        // 1. Genuine confirmed complaint
        testComplaint.setStatus(Complaint.ComplaintStatus.SUBMITTED);
        testComplaint.setOfficialRefId("NHAI-2026-OCT-88492");
        testComplaint.setSubmittedAt(java.time.Instant.now());
        complaintRepository.save(testComplaint);

        // 2. Mock complaint (should be filtered out)
        Complaint mockComplaint = new Complaint();
        mockComplaint.setUuid(UUID.randomUUID().toString());
        mockComplaint.setRoadIssue(testComplaint.getRoadIssue());
        mockComplaint.setSubject("Mock Pothole Filing");
        mockComplaint.setBodyText("Mock body");
        mockComplaint.setStatus(Complaint.ComplaintStatus.SUBMITTED);
        mockComplaint.setOfficialRefId("MOCK-NHAI-12345");
        mockComplaint.setSubmittedAt(java.time.Instant.now());
        complaintRepository.save(mockComplaint);

        // 3. Draft complaint (should be filtered out)
        Complaint draftComplaint = new Complaint();
        draftComplaint.setUuid(UUID.randomUUID().toString());
        draftComplaint.setRoadIssue(testComplaint.getRoadIssue());
        draftComplaint.setSubject("Draft Pothole Filing");
        draftComplaint.setBodyText("Draft body");
        draftComplaint.setStatus(Complaint.ComplaintStatus.DRAFT);
        complaintRepository.save(draftComplaint);

        // 4. Query confirmed history endpoint
        var resp = complaintController.getConfirmedComplaintsHistory();
        assertNotNull(resp);
        assertEquals(org.springframework.http.HttpStatus.OK, resp.getStatusCode());
        var history = resp.getBody();
        assertNotNull(history);

        // Verify genuine complaint is present
        assertTrue(history.stream().anyMatch(c -> "NHAI-2026-OCT-88492".equals(c.getOfficialRefId())));

        // Verify mock complaint is excluded
        assertFalse(history.stream().anyMatch(c -> c.getOfficialRefId() != null && c.getOfficialRefId().startsWith("MOCK-")));

        // Verify draft is excluded
        assertFalse(history.stream().anyMatch(c -> c.getComplaintId().equals(draftComplaint.getId())));

        // 5. Complaint with RUNNING or FAILED job (must be excluded even if refId was set)
        Complaint failedJobComplaint = new Complaint();
        failedJobComplaint.setUuid(UUID.randomUUID().toString());
        failedJobComplaint.setRoadIssue(testComplaint.getRoadIssue());
        failedJobComplaint.setSubject("Failed Job Complaint");
        failedJobComplaint.setBodyText("Body text");
        failedJobComplaint.setStatus(Complaint.ComplaintStatus.SUBMITTED);
        failedJobComplaint.setOfficialRefId("AP-CDMA-2026-99999");
        failedJobComplaint.setSubmittedAt(java.time.Instant.now());
        final Complaint savedFailedComplaint = complaintRepository.save(failedJobComplaint);

        AutomationJob failedJob = new AutomationJob();
        failedJob.setUuid(UUID.randomUUID().toString());
        failedJob.setComplaint(savedFailedComplaint);
        failedJob.setPortalId("AP_CDMA");
        failedJob.setMode(AutomationJob.AutomationMode.LIVE);
        failedJob.setStatus(AutomationJob.JobStatus.FAILED);
        failedJob.setOfficialReferenceNumber("AP-CDMA-2026-99999");
        automationJobRepository.save(failedJob);

        var historyAfter = complaintController.getConfirmedComplaintsHistory().getBody();
        assertNotNull(historyAfter);
        assertFalse(historyAfter.stream().anyMatch(c -> c.getComplaintId().equals(savedFailedComplaint.getId())));
    }

    @Test
    @DisplayName("Verify data minimization: only portal-relevant profile fields are dispatched in worker payload")
    void testDataMinimizationPerPortal() {
        // Create user profile with residential address and vehicle registration
        var profile = new com.roadguard.api.entity.UserProfile();
        profile.setFullName("Sita Devi");
        profile.setEmail("sita.devi@example.com");
        profile.setPhone("+91 98765 11111");
        profile.setAddress("Flat 402, Lotus Residency, MG Road");
        profile.setCityOrMunicipality("Vijayawada Municipal Corporation");
        profile.setPrimaryVrn("AP16AB1234");
        userProfileRepository.save(profile);

        // 1. NHAI dispatch: Residential address must NOT be sent (telemetry GPS is used)
        AutomationJobDto nhaiJob = automationWorkerService.dispatchFilingJob(
            testComplaint.getId(), "RAJMARGYATRA_NHAI", AutomationJob.AutomationMode.MOCK);
        assertNotNull(nhaiJob.payload());
        assertNull(nhaiJob.payload().address(), "Residential address must be omitted for NHAI highway complaint");
        assertEquals("AP16AB1234", nhaiJob.payload().vehicleNumber());

        // 2. AP CDMA dispatch: Vehicle registration must NOT be sent (civic pothole complaint)
        AutomationJobDto cdmaJob = automationWorkerService.dispatchFilingJob(
            testComplaint.getId(), "AP_CDMA", AutomationJob.AutomationMode.MOCK);
        assertNotNull(cdmaJob.payload());
        assertNull(cdmaJob.payload().vehicleNumber(), "Vehicle registration must be omitted for AP CDMA municipal complaint");
        assertEquals("Vijayawada Municipal Corporation", cdmaJob.payload().address());

        // 3. Mock Portal dispatch: No extraneous personal details
        AutomationJobDto mockJob = automationWorkerService.dispatchFilingJob(
            testComplaint.getId(), "MOCK_PORTAL", AutomationJob.AutomationMode.MOCK);
        assertNotNull(mockJob.payload());
        assertNull(mockJob.payload().vehicleNumber());
        assertNull(mockJob.payload().address());
    }
}
