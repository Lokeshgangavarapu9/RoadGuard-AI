package com.roadguard.api.service;

import com.roadguard.api.dto.SimulateSubmissionResponse;
import com.roadguard.api.entity.Complaint;
import org.springframework.stereotype.Service;

import java.time.Instant;

/**
 * @deprecated Replaced by {@link ComplaintAgentService} which implements the verified 9-state civic complaint lifecycle.
 */
@Deprecated
@Service
public class ComplaintService {

    private final ComplaintAgentService complaintAgentService;

    public ComplaintService(ComplaintAgentService complaintAgentService) {
        this.complaintAgentService = complaintAgentService;
    }

    public Complaint autoDraftComplaint(Long issueId, String complainantName, String complainantEmail, String complainantPhone) {
        return complaintAgentService.prepareComplaint(issueId, complainantName, complainantEmail, complainantPhone);
    }

    public SimulateSubmissionResponse simulateSubmission(Long complaintId) {
        ComplaintAgentService.PortalHandoffPacket packet = complaintAgentService.initiatePortalHandoff(complaintId);
        SimulateSubmissionResponse resp = new SimulateSubmissionResponse();
        resp.setComplaintId(packet.complaintId());
        resp.setStatus("AWAITING_USER_ACTION");
        resp.setSimulatedRefId("AWAITING_PORTAL_RECEIPT");
        resp.setSimulatedAt(Instant.now());
        resp.setWarning("Official portal handoff initiated. Complete submission on official portal and record verified reference ID.");
        resp.setReceiptText(packet.dossierText());
        return resp;
    }
}
