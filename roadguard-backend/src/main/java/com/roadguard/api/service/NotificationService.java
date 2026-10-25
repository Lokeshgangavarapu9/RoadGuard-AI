package com.roadguard.api.service;

import com.roadguard.api.dto.SimulateSubmissionResponse;
import com.roadguard.api.entity.Complaint;
import com.roadguard.api.entity.Journey;
import com.roadguard.api.entity.NotificationEvent;
import com.roadguard.api.repository.NotificationEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    @Value("${roadguard.mail.enabled:false}")
    private boolean mailEnabled;

    @Value("${roadguard.mail.from:noreply@roadguard-ai.local}")
    private String mailFrom;

    private final NotificationEventRepository notificationRepository;
    private final JavaMailSender mailSender;

    public NotificationService(
        NotificationEventRepository notificationRepository,
        JavaMailSender mailSender
    ) {
        this.notificationRepository = notificationRepository;
        this.mailSender = mailSender;
    }

    public void notifyJourneyStarted(Journey journey) {
        String email = journey.getRiderEmail();
        if (email == null || email.isBlank()) return;

        String subject = "RoadGuard AI — Journey Started (" + journey.getVehicleType() + ")";
        String content = "Hello " + (journey.getRiderName() != null ? journey.getRiderName() : "Rider") + ",\n\n"
            + "Your road-monitoring journey has commenced at " + journey.getCreatedAt() + ".\n"
            + "RoadGuard AI is now actively analyzing road condition telemetry.\n\n"
            + "Stay safe on the road!\n"
            + "RoadGuard AI Team";

        sendOrLogNotification(NotificationEvent.EventType.JOURNEY_STARTED, journey.getId(), "JOURNEY", email, subject, content);
    }

    public void notifyJourneyStopped(Journey journey, long issueCount) {
        String email = journey.getRiderEmail();
        if (email == null || email.isBlank()) return;

        String subject = "RoadGuard AI — Journey Summary & Inspection Report";
        String content = "Hello " + (journey.getRiderName() != null ? journey.getRiderName() : "Rider") + ",\n\n"
            + "Your journey has concluded.\n"
            + "• Total Frames Analyzed: " + journey.getTotalFrames() + "\n"
            + "• Verified Road Issues Detected: " + issueCount + "\n"
            + "• Started At: " + journey.getStartedAt() + "\n"
            + "• Stopped At: " + journey.getStoppedAt() + "\n\n"
            + "Review detected defects and generate automated grievance filings in your dashboard.\n\n"
            + "RoadGuard AI Team";

        sendOrLogNotification(NotificationEvent.EventType.JOURNEY_STOPPED, journey.getId(), "JOURNEY", email, subject, content);
    }

    public void notifyComplaintSimulated(Complaint complaint, SimulateSubmissionResponse receipt) {
        String email = complaint.getComplainantEmail();
        if (email == null || email.isBlank()) return;

        String subject = "RoadGuard AI — Grievance Submission Receipt [" + receipt.getSimulatedRefId() + "]";
        String content = receipt.getReceiptText();

        sendOrLogNotification(NotificationEvent.EventType.COMPLAINT_SIMULATED, complaint.getId(), "COMPLAINT", email, subject, content);
    }

    private void sendOrLogNotification(
        NotificationEvent.EventType type,
        Long refId,
        String refType,
        String recipient,
        String subject,
        String content
    ) {
        NotificationEvent event = new NotificationEvent();
        event.setEventType(type);
        event.setReferenceId(refId);
        event.setReferenceType(refType);
        event.setRecipientEmail(recipient);
        event.setSubject(subject);

        if (mailEnabled) {
            try {
                SimpleMailMessage msg = new SimpleMailMessage();
                msg.setFrom(mailFrom);
                msg.setTo(recipient);
                msg.setSubject(subject);
                msg.setText(content);
                mailSender.send(msg);
                event.setSent(true);
                event.setSentAt(Instant.now());
                log.info("Email sent successfully to {}", recipient);
            } catch (Exception e) {
                log.warn("Failed to send email to {}: {}", recipient, e.getMessage());
                event.setSent(false);
                event.setFailureReason(e.getMessage());
            }
        } else {
            // Development mock mode: log the notification content
            log.info("[NOTIFICATION MOCK] To: {} | Subject: {}\n{}", recipient, subject, content);
            event.setSent(true);
            event.setSentAt(Instant.now());
        }

        notificationRepository.save(event);
    }
}
