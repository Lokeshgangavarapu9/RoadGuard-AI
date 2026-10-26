package com.roadguard.api;

import com.roadguard.api.entity.AutomationJob;
import com.roadguard.api.entity.Complaint;
import com.roadguard.api.entity.Journey;
import com.roadguard.api.entity.RoadIssue;
import com.roadguard.api.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@SuppressWarnings("null")
class ComplaintControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ComplaintRepository complaintRepository;

    @Autowired
    private RoadIssueRepository roadIssueRepository;

    @Autowired
    private JourneyRepository journeyRepository;

    @Autowired
    private AutomationJobRepository automationJobRepository;

    private RoadIssue testIssue;

    @BeforeEach
    void setUp() {
        complaintRepository.deleteAll();

        Journey journey = new Journey();
        journey.setUuid(UUID.randomUUID().toString());
        journey.setRiderName("Citizen Tester");
        journey.setVehicleType(Journey.VehicleType.CAR);
        journey.setStatus(Journey.JourneyStatus.ACTIVE);
        journeyRepository.save(journey);

        testIssue = new RoadIssue();
        testIssue.setUuid(UUID.randomUUID().toString());
        testIssue.setJourney(journey);
        testIssue.setDefectClass(RoadIssue.DefectClass.POTHOLE);
        testIssue.setRoadName("NH-16 Vijayawada Corridor");
        testIssue.setLatitude(16.5062);
        testIssue.setLongitude(80.6480);
        testIssue.setStatus(RoadIssue.IssueStatus.DETECTED);
        roadIssueRepository.save(testIssue);
    }

    @Test
    @DisplayName("GET /api/v1/complaints/confirmed-history returns empty collection when no confirmed complaints exist")
    void getConfirmedHistory_whenEmpty_returnsEmptyList() throws Exception {
        mockMvc.perform(get("/api/v1/complaints/confirmed-history")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    @DisplayName("GET /api/v1/complaints/confirmed-history returns genuinely confirmed complaints")
    void getConfirmedHistory_whenConfirmedExist_returnsComplaints() throws Exception {
        Complaint c = new Complaint();
        c.setUuid(UUID.randomUUID().toString());
        c.setRoadIssue(testIssue);
        c.setSubject("Severe NH-16 Pothole");
        c.setBodyText("Deep crater near Benz Circle.");
        c.setComplainantName("Citizen Verified");
        c.setStatus(Complaint.ComplaintStatus.SUBMITTED);
        c.setOfficialRefId("NHAI-2026-OCT-77192");
        c.setSubmittedAt(Instant.now());
        complaintRepository.save(c);

        mockMvc.perform(get("/api/v1/complaints/confirmed-history")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].officialRefId", is("NHAI-2026-OCT-77192")))
            .andExpect(jsonPath("$[0].defectCategory", is("POTHOLE")))
            .andExpect(jsonPath("$[0].roadName", is("NH-16 Vijayawada Corridor")))
            .andExpect(jsonPath("$[0].filingChannel", is("Citizen Assisted Handoff")));
    }

    @Test
    @DisplayName("GET /api/v1/complaints/confirmed-history excludes drafts, unapproved, and mock submissions")
    void getConfirmedHistory_excludesDraftsAndMocks() throws Exception {
        // Draft
        Complaint draft = new Complaint();
        draft.setUuid(UUID.randomUUID().toString());
        draft.setRoadIssue(testIssue);
        draft.setSubject("Draft Complaint");
        draft.setBodyText("Draft complaint body text");
        draft.setStatus(Complaint.ComplaintStatus.DRAFT);
        complaintRepository.save(draft);

        // Ready to submit
        Complaint ready = new Complaint();
        ready.setUuid(UUID.randomUUID().toString());
        ready.setRoadIssue(testIssue);
        ready.setSubject("Ready Complaint");
        ready.setBodyText("Ready complaint body text");
        ready.setStatus(Complaint.ComplaintStatus.READY_TO_SUBMIT);
        complaintRepository.save(ready);

        // Mock reference ID
        Complaint mock = new Complaint();
        mock.setUuid(UUID.randomUUID().toString());
        mock.setRoadIssue(testIssue);
        mock.setSubject("Mock Complaint");
        mock.setBodyText("Mock complaint body text");
        mock.setStatus(Complaint.ComplaintStatus.SUBMITTED);
        mock.setOfficialRefId("MOCK-NHAI-12345");
        mock.setSubmittedAt(Instant.now());
        complaintRepository.save(mock);

        // Automation job in mock mode
        Complaint mockJobComplaint = new Complaint();
        mockJobComplaint.setUuid(UUID.randomUUID().toString());
        mockJobComplaint.setRoadIssue(testIssue);
        mockJobComplaint.setSubject("Job Mock Complaint");
        mockJobComplaint.setBodyText("Job mock complaint body text");
        mockJobComplaint.setStatus(Complaint.ComplaintStatus.SUBMITTED);
        mockJobComplaint.setOfficialRefId("NHAI-JOB-9999");
        mockJobComplaint.setSubmittedAt(Instant.now());
        Complaint savedMockJob = complaintRepository.save(mockJobComplaint);

        AutomationJob job = new AutomationJob();
        job.setUuid(UUID.randomUUID().toString());
        job.setComplaint(savedMockJob);
        job.setPortalId("NHAI_RAJMARGYATRA");
        job.setMode(AutomationJob.AutomationMode.MOCK);
        job.setStatus(AutomationJob.JobStatus.COMPLETED);
        job.setOfficialReferenceNumber("NHAI-JOB-9999");
        automationJobRepository.save(job);

        // Genuine complaint
        Complaint genuine = new Complaint();
        genuine.setUuid(UUID.randomUUID().toString());
        genuine.setRoadIssue(testIssue);
        genuine.setSubject("Genuine Road Issue");
        genuine.setBodyText("Genuine road issue verified body text");
        genuine.setStatus(Complaint.ComplaintStatus.SUBMITTED);
        genuine.setOfficialRefId("APCDMA-2026-66442");
        genuine.setSubmittedAt(Instant.now());
        complaintRepository.save(genuine);

        mockMvc.perform(get("/api/v1/complaints/confirmed-history")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].officialRefId", is("APCDMA-2026-66442")));
    }

    @Test
    @DisplayName("GET /api/v1/complaints/{id} with non-numeric string returns 404 Not Found rather than confusing 400")
    void getComplaint_withNonNumericString_returns404() throws Exception {
        mockMvc.perform(get("/api/v1/complaints/not-a-number")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("GET /api/v1/complaints/{id} with non-existent numeric ID returns 404 with structured JSON")
    void getComplaint_withNonExistentNumericId_returns404Structured() throws Exception {
        mockMvc.perform(get("/api/v1/complaints/99999999")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.error", is("Not Found")))
            .andExpect(jsonPath("$.message", containsString("Complaint not found: 99999999")));
    }
}
