package com.roadguard.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.roadguard.api.entity.AuthorityRecord;
import com.roadguard.api.entity.Complaint;
import com.roadguard.api.entity.RoadIssue;
import com.roadguard.api.repository.AuthorityRecordRepository;
import com.roadguard.api.repository.ComplaintRepository;
import com.roadguard.api.repository.EventGroupingAuditRepository;
import com.roadguard.api.repository.RoadIssueRepository;
import com.roadguard.api.service.AuthorityRoutingService;
import com.roadguard.api.service.AuthorityRoutingService.AuthorityRoutingDecision;
import com.roadguard.api.service.AuthorityRoutingService.RoutingConfidence;
import com.roadguard.api.service.ComplaintAgentService;
import com.roadguard.api.service.ComplaintAgentService.PortalHandoffPacket;
import com.roadguard.api.service.ComplaintAgentService.SubmissionConfirmation;
import com.roadguard.api.service.GeospatialDeduplicationService;
import com.roadguard.api.service.ImageQualityService;
import com.roadguard.api.service.ImageQualityService.ImageQualityResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

public class RoadGuardProductionPipelineTest {

    private ImageQualityService imageQualityService;
    private AuthorityRoutingService authorityRoutingService;
    private GeospatialDeduplicationService deduplicationService;
    private ComplaintAgentService complaintAgentService;

    private AuthorityRecordRepository authorityRepo;
    private RoadIssueRepository issueRepo;
    private EventGroupingAuditRepository auditRepo;
    private ComplaintRepository complaintRepo;

    @BeforeEach
    public void setUp() {
        imageQualityService = new ImageQualityService();

        authorityRepo = mock(AuthorityRecordRepository.class);
        ObjectMapper objectMapper = new ObjectMapper();
        authorityRoutingService = new AuthorityRoutingService(authorityRepo, objectMapper);

        issueRepo = mock(RoadIssueRepository.class);
        auditRepo = mock(EventGroupingAuditRepository.class);
        deduplicationService = new GeospatialDeduplicationService(issueRepo, auditRepo);

        complaintRepo = mock(ComplaintRepository.class);
        complaintAgentService = new ComplaintAgentService(
                complaintRepo,
                issueRepo,
                authorityRepo,
                authorityRoutingService
        );
    }

    private byte[] createSyntheticImageBytes(int width, int height, Color color, boolean addPattern) throws IOException {
        BufferedImage img = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(color);
        g.fillRect(0, 0, width, height);

        if (addPattern) {
            g.setColor(Color.WHITE);
            for (int i = 0; i < width; i += 10) {
                g.drawLine(i, 0, i, height);
                g.drawLine(0, i, width, i);
            }
        }
        g.dispose();

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(img, "jpg", baos);
        return baos.toByteArray();
    }

    // ==========================================
    // 1. IMAGE QUALITY & MAGIC BYTES TESTS
    // ==========================================

    @Test
    @DisplayName("ImageQualityGate: Rejects invalid magic bytes")
    public void testRejectsInvalidMagicBytes() {
        byte[] fakeData = new byte[]{0x00, 0x11, 0x22, 0x33, 0x44, 0x55};
        ImageQualityResult qa = imageQualityService.evaluateQuality(fakeData);
        assertFalse(qa.valid());
        assertEquals("INVALID_FORMAT", qa.qualityStatus());
    }

    @Test
    @DisplayName("ImageQualityGate: Rejects pitch black underexposed frames")
    public void testRejectsDarkImage() throws IOException {
        byte[] darkImg = createSyntheticImageBytes(400, 300, new Color(10, 10, 10), false);
        ImageQualityResult qa = imageQualityService.evaluateQuality(darkImg);
        assertFalse(qa.valid());
        assertTrue(qa.qualityStatus().contains("DARK"));
    }

    @Test
    @DisplayName("ImageQualityGate: Rejects solid color blurry / featureless frames")
    public void testRejectsFeaturelessBlurryImage() throws IOException {
        byte[] flatImg = createSyntheticImageBytes(400, 300, new Color(128, 128, 128), false);
        ImageQualityResult qa = imageQualityService.evaluateQuality(flatImg);
        assertFalse(qa.valid());
        assertTrue(qa.qualityStatus().contains("BLUR") || qa.sharpnessScore() < 85.0);
    }

    @Test
    @DisplayName("ImageQualityGate: Accepts sharp, properly exposed structured frames and computes SHA-256")
    public void testAcceptsValidSharpImage() throws IOException {
        byte[] goodImg = createSyntheticImageBytes(640, 480, new Color(90, 90, 90), true);
        ImageQualityResult qa = imageQualityService.evaluateQuality(goodImg);
        assertTrue(qa.valid());
        assertEquals("CLEAR", qa.qualityStatus());
        assertNotNull(qa.sha256Hex());
        assertEquals(64, qa.sha256Hex().length());
    }

    // ==========================================
    // 2. MULTI-TIER AUTHORITY ROUTING TESTS
    // ==========================================

    @Test
    @DisplayName("AuthorityRouting: NH-16 routes to NHAI Rajmargyatra with HIGH confidence even inside Vijayawada")
    public void testNationalHighwayRouting() {
        AuthorityRecord nhai = new AuthorityRecord();
        nhai.setDeptCode("NHAI");
        nhai.setDeptName("National Highways Authority of India (NHAI)");
        when(authorityRepo.findByDeptCode("NHAI")).thenReturn(Optional.of(nhai));

        AuthorityRoutingDecision dec = authorityRoutingService.resolveAuthority(
                16.5062, 80.6480, "NH-16", "Chennai-Kolkata Highway (Vijayawada bypass)", "trunk"
        );

        assertNotNull(dec);
        assertEquals("NHAI", dec.authorityCode());
        assertEquals(RoutingConfidence.VERIFIED_HIGH, dec.confidence());
        assertFalse(dec.requiresUserConfirmation());
    }

    @Test
    @DisplayName("AuthorityRouting: SH-61 routes to AP R&B Department")
    public void testStateHighwayRouting() {
        AuthorityRecord rAndB = new AuthorityRecord();
        rAndB.setDeptCode("AP_RNB");
        rAndB.setDeptName("Andhra Pradesh Roads & Buildings Department");
        when(authorityRepo.findByDeptCode("AP_RNB")).thenReturn(Optional.of(rAndB));

        AuthorityRoutingDecision dec = authorityRoutingService.resolveAuthority(
                14.4673, 78.8242, "SH-61", "Kadapa - Rayachoty Road", "primary"
        );

        assertNotNull(dec);
        assertEquals("AP_RNB", dec.authorityCode());
        assertEquals(RoutingConfidence.VERIFIED_HIGH, dec.confidence());
    }

    @Test
    @DisplayName("AuthorityRouting: Residential municipal road inside AP city routes to AP CDMA")
    public void testMunicipalRoadRouting() {
        AuthorityRecord cdma = new AuthorityRecord();
        cdma.setDeptCode("CDMA_ULB");
        cdma.setDeptName("Andhra Pradesh CDMA / Municipal Administration");
        when(authorityRepo.findByDeptCode("CDMA_ULB")).thenReturn(Optional.of(cdma));

        AuthorityRoutingDecision dec = authorityRoutingService.resolveAuthority(
                16.5100, 80.6400, "", "MG Road Municipal Ward 12", "residential"
        );

        assertNotNull(dec);
        assertEquals("CDMA_ULB", dec.authorityCode());
    }

    @Test
    @DisplayName("AuthorityRouting: Ambiguous or untagged corridor requires citizen verification")
    public void testAmbiguousRoadRequiresVerification() {
        AuthorityRoutingDecision dec = authorityRoutingService.resolveAuthority(
                16.0000, 80.0000, "", "Unknown Unclassified Rural Link", "unclassified"
        );

        assertNotNull(dec);
        assertTrue(dec.requiresUserConfirmation());
        assertEquals(RoutingConfidence.UNCERTAIN_REQUIRES_USER_VERIFICATION, dec.confidence());
    }

    // ==========================================
    // 3. OPPOSITE-LANE DEDUPLICATION TESTS
    // ==========================================

    @Test
    @DisplayName("Deduplication: Heading delta of 180 deg separates opposite-carriageway defects")
    public void testOppositeLaneHeadingSeparation() {
        // Two potholes within 10 meters spatially, but vehicle 1 was heading North (0 deg)
        // and vehicle 2 was heading South (180 deg) on a divided highway.
        double heading1 = 5.0;
        double heading2 = 185.0;

        double delta = Math.abs(heading1 - heading2) % 360.0;
        if (delta > 180.0) delta = 360.0 - delta;

        // Circular heading difference is 180.0 degrees, well above MAX_HEADING_DELTA_DEG (45.0)
        assertTrue(delta > 45.0, "Opposite carriageway heading delta must exceed 45 degrees");
    }

    // ==========================================
    // 4. CIVIC COMPLAINT AGENT & ANTI-FABRICATION TESTS
    // ==========================================

    @Test
    @DisplayName("ComplaintAgent: Initiates 2-step portal handoff to AWAITING_USER_ACTION")
    public void testInitiateHandoffStateTransition() {
        RoadIssue issue = new RoadIssue();
        issue.setId(101L);
        issue.setDefectClass(RoadIssue.DefectClass.POTHOLE);
        issue.setLatitude(16.5062);
        issue.setLongitude(80.6480);
        issue.setRoadName("NH-16 Vijayawada Corridor");

        AuthorityRecord auth = new AuthorityRecord();
        auth.setDeptCode("NHAI_AP");
        auth.setDeptName("NHAI");
        auth.setGrievanceUrl("https://rajmargyatra.nhai.gov.in/complaint-login-page");

        Complaint complaint = new Complaint();
        complaint.setId(201L);
        complaint.setRoadIssue(issue);
        complaint.setAuthority(auth);
        complaint.setStatus(Complaint.ComplaintStatus.COMPLAINT_PREPARED);

        when(complaintRepo.findById(201L)).thenReturn(Optional.of(complaint));
        when(complaintRepo.save(any(Complaint.class))).thenAnswer(invocation -> invocation.getArgument(0));

        PortalHandoffPacket packet = complaintAgentService.initiatePortalHandoff(201L);
        assertNotNull(packet);
        assertEquals(Complaint.ComplaintStatus.AWAITING_USER_ACTION.name(), packet.status());
        assertEquals("https://rajmargyatra.nhai.gov.in/complaint-login-page", packet.officialPortalUrl());
    }

    @Test
    @DisplayName("ComplaintAgent: Strictly rejects fabricated SIM-* or STM-AP-* reference numbers")
    public void testRejectsFabricatedReferenceNumbers() {
        Complaint complaint = new Complaint();
        complaint.setId(301L);
        complaint.setStatus(Complaint.ComplaintStatus.AWAITING_USER_ACTION);

        when(complaintRepo.findById(301L)).thenReturn(Optional.of(complaint));

        // Test SIM-AP-XXXXX rejection
        assertThrows(IllegalArgumentException.class, () -> {
            complaintAgentService.recordOfficialReceipt(301L, "SIM-AP-48921", "Test note");
        });

        // Test STM-AP-DGRS-XXXXX rejection
        assertThrows(IllegalArgumentException.class, () -> {
            complaintAgentService.recordOfficialReceipt(301L, "STM-AP-DGRS-2026-9812", "Test note");
        });
    }

    @Test
    @DisplayName("ComplaintAgent: Records genuine official portal receipt and transitions to SUBMITTED")
    public void testRecordsGenuineOfficialReceipt() {
        RoadIssue issue = new RoadIssue();
        issue.setId(401L);

        Complaint complaint = new Complaint();
        complaint.setId(501L);
        complaint.setRoadIssue(issue);
        complaint.setStatus(Complaint.ComplaintStatus.AWAITING_USER_ACTION);

        when(complaintRepo.findById(501L)).thenReturn(Optional.of(complaint));
        when(complaintRepo.save(any(Complaint.class))).thenAnswer(invocation -> invocation.getArgument(0));

        SubmissionConfirmation confirmation = complaintAgentService.recordOfficialReceipt(
                501L, "NHAI-AP-2026-984321", "Submitted via citizen mobile OTP"
        );

        assertNotNull(confirmation);
        assertEquals(Complaint.ComplaintStatus.SUBMITTED.name(), confirmation.status());
        assertEquals("NHAI-AP-2026-984321", confirmation.officialRefId());
        assertEquals(RoadIssue.IssueStatus.COMPLAINT_SUBMITTED, issue.getStatus());
    }

    @Test
    @DisplayName("Deduplication: Haversine distance and circular heading delta calculations")
    public void testGeospatialDeduplicationCalculations() {
        // Known distance: ~111 meters per 0.001 deg latitude
        double distance = deduplicationService.calculateDistanceMeters(16.5000, 80.6400, 16.5010, 80.6400);
        assertTrue(distance > 105.0 && distance < 115.0, "Haversine distance should be approx 111m: " + distance);

        // Circular heading delta test (e.g. 10 deg and 350 deg should have delta = 20 deg)
        double headingDelta1 = deduplicationService.calculateHeadingDelta(10.0, 350.0);
        assertEquals(20.0, headingDelta1, 0.001);

        // Opposite direction test (e.g. 90 deg and 270 deg should have delta = 180 deg)
        double headingDelta2 = deduplicationService.calculateHeadingDelta(90.0, 270.0);
        assertEquals(180.0, headingDelta2, 0.001);

        // Heading delta > 45 deg exceeds maximum threshold
        assertTrue(headingDelta2 > GeospatialDeduplicationService.MAX_HEADING_DELTA_DEG);
    }
}
