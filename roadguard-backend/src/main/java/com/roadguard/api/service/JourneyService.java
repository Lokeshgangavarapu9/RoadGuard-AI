package com.roadguard.api.service;

import com.roadguard.api.dto.*;
import com.roadguard.api.entity.EvidenceFrame;
import com.roadguard.api.entity.GpsLocation;
import com.roadguard.api.entity.Journey;
import com.roadguard.api.repository.EvidenceFrameRepository;
import com.roadguard.api.repository.GpsLocationRepository;
import com.roadguard.api.repository.JourneyRepository;
import com.roadguard.api.repository.RoadIssueRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@SuppressWarnings("null")
public class JourneyService {

    private static final Logger log = LoggerFactory.getLogger(JourneyService.class);

    private final JourneyRepository journeyRepository;
    private final GpsLocationRepository gpsLocationRepository;
    private final EvidenceFrameRepository evidenceFrameRepository;
    private final RoadIssueRepository roadIssueRepository;
    private final EvidenceStorageService storageService;
    private final InferenceService inferenceService;
    private final NotificationService notificationService;

    public JourneyService(
        JourneyRepository journeyRepository,
        GpsLocationRepository gpsLocationRepository,
        EvidenceFrameRepository evidenceFrameRepository,
        RoadIssueRepository roadIssueRepository,
        EvidenceStorageService storageService,
        InferenceService inferenceService,
        NotificationService notificationService
    ) {
        this.journeyRepository = journeyRepository;
        this.gpsLocationRepository = gpsLocationRepository;
        this.evidenceFrameRepository = evidenceFrameRepository;
        this.roadIssueRepository = roadIssueRepository;
        this.storageService = storageService;
        this.inferenceService = inferenceService;
        this.notificationService = notificationService;
    }

    @Transactional
    public JourneyResponse createJourney(CreateJourneyRequest req) {
        Journey journey = new Journey();
        journey.setUuid(UUID.randomUUID().toString());
        journey.setStatus(Journey.JourneyStatus.ACTIVE);
        journey.setVehicleType(req.getVehicleType() != null ? req.getVehicleType() : Journey.VehicleType.CAR);
        journey.setRiderName(req.getRiderName());
        journey.setRiderEmail(req.getRiderEmail());
        journey.setStartLatitude(req.getStartLatitude());
        journey.setStartLongitude(req.getStartLongitude());
        journey.setStartAddress(req.getStartAddress());
        journey.setStartedAt(Instant.now());
        journey.setDemoMode(req.getDemoMode() != null ? req.getDemoMode() : false);
        journey.setDemoSource(req.getDemoSource());
        journey.setNotes(req.getNotes());

        Journey saved = journeyRepository.save(journey);
        log.info("Started new journey #{} ({})", saved.getId(), saved.getUuid());

        // Notify rider
        notificationService.notifyJourneyStarted(saved);

        return JourneyResponse.fromEntity(saved, 0L, 0L);
    }

    @Transactional
    public JourneyResponse stopJourney(Long id, StopJourneyRequest req) {
        Journey journey = journeyRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Journey not found: " + id));

        if (journey.getTotalFrames() == null || journey.getTotalFrames() == 0) {
            journey.setStatus(Journey.JourneyStatus.CANCELLED);
            log.info("Journey #{} had 0 frames analyzed; marking status as CANCELLED to prevent polluting history and reports.", id);
        } else {
            journey.setStatus(Journey.JourneyStatus.STOPPED);
        }
        journey.setStoppedAt(Instant.now());
        if (req != null) {
            if (req.getNotes() != null) journey.setNotes(req.getNotes());
            if (req.getEndLatitude() != null) journey.setEndLatitude(req.getEndLatitude());
            if (req.getEndLongitude() != null) journey.setEndLongitude(req.getEndLongitude());
            if (req.getEndAddress() != null) journey.setEndAddress(req.getEndAddress());
            if (req.getDistanceMeters() != null) journey.setDistanceMeters(req.getDistanceMeters());
        }

        List<GpsLocation> locations = gpsLocationRepository.findByJourneyIdOrderBySequenceNumAsc(id);
        if (!locations.isEmpty()) {
            GpsLocation lastLoc = locations.get(locations.size() - 1);
            if (journey.getEndLatitude() == null) {
                journey.setEndLatitude(lastLoc.getLatitude());
                journey.setEndLongitude(lastLoc.getLongitude());
            }
            if (journey.getDistanceMeters() == null || journey.getDistanceMeters() == 0.0) {
                double computedDistance = 0.0;
                for (int i = 1; i < locations.size(); i++) {
                    GpsLocation p1 = locations.get(i - 1);
                    GpsLocation p2 = locations.get(i);
                    double stepDist = calculateHaversineMeters(p1.getLatitude(), p1.getLongitude(), p2.getLatitude(), p2.getLongitude());
                    if (stepDist >= 2.0 && stepDist < 500.0) {
                        computedDistance += stepDist;
                    }
                }
                journey.setDistanceMeters(computedDistance);
            }
        }

        Journey saved = journeyRepository.save(journey);
        long issueCount = roadIssueRepository.findByJourneyId(id).size();
        long gpsCount = locations.size();

        log.info("Stopped journey #{} with {} frames, {} issues, distance: {}m", id, saved.getTotalFrames(), issueCount, saved.getDistanceMeters());
        notificationService.notifyJourneyStopped(saved, issueCount);

        return JourneyResponse.fromEntity(saved, issueCount, gpsCount);
    }

    private double calculateHaversineMeters(double lat1, double lon1, double lat2, double lon2) {
        final int R = 6371000;
        double latDistance = Math.toRadians(lat2 - lat1);
        double lonDistance = Math.toRadians(lon2 - lon1);
        double a = Math.sin(latDistance / 2) * Math.sin(latDistance / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(lonDistance / 2) * Math.sin(lonDistance / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    @Transactional
    public List<GpsLocation> addGpsBatch(Long journeyId, GpsBatchRequest req) {
        Journey journey = journeyRepository.findById(journeyId)
            .orElseThrow(() -> new IllegalArgumentException("Journey not found: " + journeyId));

        List<GpsLocation> locations = new ArrayList<>();
        int baseSeq = (int) gpsLocationRepository.countByJourneyId(journeyId);

        for (int i = 0; i < req.getPoints().size(); i++) {
            GpsPointDto p = req.getPoints().get(i);
            GpsLocation loc = new GpsLocation();
            loc.setJourney(journey);
            loc.setLatitude(p.getLatitude());
            loc.setLongitude(p.getLongitude());
            loc.setAltitude(p.getAltitude());
            loc.setAccuracy(p.getAccuracy());
            loc.setSpeed(p.getSpeed());
            loc.setHeading(p.getHeading());
            loc.setRecordedAt(p.getRecordedAt() != null ? p.getRecordedAt() : Instant.now());
            loc.setSequenceNum(p.getSequenceNum() != null ? p.getSequenceNum() : (baseSeq + i + 1));
            locations.add(loc);
        }

        return gpsLocationRepository.saveAll(locations);
    }

    @Transactional
    public EvidenceFrameResponse uploadEvidenceFrame(
        Long journeyId,
        MultipartFile file,
        Double latitude,
        Double longitude,
        Instant capturedAt,
        Integer frameSequence
    ) throws IOException {
        return uploadEvidenceFrame(journeyId, file, latitude, longitude, capturedAt, frameSequence, null, null, null, null);
    }

    @Transactional
    public EvidenceFrameResponse uploadEvidenceFrame(
        Long journeyId,
        MultipartFile file,
        Double latitude,
        Double longitude,
        Instant capturedAt,
        Integer frameSequence,
        Double accuracy,
        Double heading,
        Double speed,
        String clientSha256
    ) throws IOException {
        Journey journey = journeyRepository.findById(journeyId)
            .orElseThrow(() -> new IllegalArgumentException("Journey not found: " + journeyId));

        // 1. Store frame on filesystem with SHA256 and PII check
        EvidenceStorageService.StoredFileMeta meta = storageService.storeFrame(journey.getUuid(), file);

        // 2. Persist EvidenceFrame record
        EvidenceFrame frame = new EvidenceFrame();
        frame.setUuid(UUID.randomUUID().toString());
        frame.setJourney(journey);
        frame.setStorageKey(meta.storageKey);
        frame.setStorageType(EvidenceFrame.StorageType.LOCAL);
        frame.setOriginalFilename(meta.originalFilename);
        frame.setContentType(meta.contentType);
        frame.setFileSizeBytes(meta.fileSizeBytes);
        frame.setSha256Digest(clientSha256 != null && !clientSha256.isBlank() ? clientSha256 : meta.sha256Digest);
        frame.setPiiProcessed(meta.piiProcessed);
        frame.setLatitude(latitude);
        frame.setLongitude(longitude);
        frame.setGpsAccuracyM(accuracy);
        frame.setHeadingDeg(heading);
        frame.setSpeedMps(speed);
        frame.setCapturedAt(capturedAt != null ? capturedAt : Instant.now());
        frame.setSourceType(journey.getDemoMode() ? EvidenceFrame.SourceType.PRERECORDED : EvidenceFrame.SourceType.LIVE_CAMERA);
        frame.setFrameSequence(frameSequence != null ? frameSequence : (journey.getTotalFrames() + 1));
        frame.setInferenceStatus(EvidenceFrame.InferenceStatus.PROCESSING);

        EvidenceFrame savedFrame = evidenceFrameRepository.save(frame);

        // Update journey statistics
        journey.setTotalFrames(journey.getTotalFrames() + 1);
        journeyRepository.save(journey);

        // 3. Trigger inference
        List<com.roadguard.api.entity.DetectionObservation> observations = inferenceService.processFrame(savedFrame);

        return EvidenceFrameResponse.fromEntity(savedFrame, observations);
    }

    @Transactional
    public Journey getOrCreateQuickScanJourney() {
        return journeyRepository.findAll().stream()
            .filter(j -> "Quick Scan Inspection".equals(j.getRiderName()))
            .findFirst()
            .orElseGet(() -> {
                Journey j = new Journey();
                j.setUuid(UUID.randomUUID().toString());
                j.setRiderName("Quick Scan Inspection");
                j.setVehicleType(Journey.VehicleType.CAR);
                j.setStatus(Journey.JourneyStatus.ACTIVE);
                return journeyRepository.save(j);
            });
    }

    @Transactional
    public EvidenceFrameResponse uploadQuickScanFrame(
        MultipartFile file,
        Double latitude,
        Double longitude,
        Instant capturedAt,
        Integer frameSequence,
        Double accuracy,
        Double heading,
        Double speed,
        String clientSha256
    ) throws IOException {
        Journey journey = getOrCreateQuickScanJourney();
        return uploadEvidenceFrame(journey.getId(), file, latitude, longitude, capturedAt, frameSequence, accuracy, heading, speed, clientSha256);
    }

    public List<JourneyResponse> getAllJourneys() {
        return journeyRepository.findAllByOrderByCreatedAtDesc().stream()
            .map(j -> {
                long issues = roadIssueRepository.findByJourneyId(j.getId()).size();
                long gps = gpsLocationRepository.countByJourneyId(j.getId());
                return JourneyResponse.fromEntity(j, issues, gps);
            })
            .collect(Collectors.toList());
    }

    public JourneyResponse getJourneyById(Long id) {
        Journey j = journeyRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Journey not found: " + id));
        long issues = roadIssueRepository.findByJourneyId(j.getId()).size();
        long gps = gpsLocationRepository.countByJourneyId(j.getId());
        return JourneyResponse.fromEntity(j, issues, gps);
    }
}
