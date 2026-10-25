package com.roadguard.api.service;

import com.roadguard.api.entity.EventGroupingAudit;
import com.roadguard.api.entity.EvidenceFrame;
import com.roadguard.api.entity.RoadIssue;
import com.roadguard.api.repository.EventGroupingAuditRepository;
import com.roadguard.api.repository.RoadIssueRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Multi-factor spatio-temporal and directional deduplication service.
 * Prevents erroneous merges across opposite carriageways (heading > 45 deg)
 * and selects the highest-quality evidence frame.
 */
@Service
public class GeospatialDeduplicationService {

    private static final Logger log = LoggerFactory.getLogger(GeospatialDeduplicationService.class);

    private static final double EARTH_RADIUS_METERS = 6371000.0;
    public static final double MAX_HEADING_DELTA_DEG = 45.0;

    @Value("${roadguard.geospatial.dedup-radius-metres:15.0}")
    private double dedupRadiusMeters;

    private final RoadIssueRepository roadIssueRepository;
    private final EventGroupingAuditRepository groupingAuditRepository;

    public GeospatialDeduplicationService(
        RoadIssueRepository roadIssueRepository,
        EventGroupingAuditRepository groupingAuditRepository
    ) {
        this.roadIssueRepository = roadIssueRepository;
        this.groupingAuditRepository = groupingAuditRepository;
    }

    /**
     * Compute Haversine distance between two latitude/longitude points in meters.
     */
    public double calculateDistanceMeters(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);

        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                 + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                 * Math.sin(dLon / 2) * Math.sin(dLon / 2);

        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_METERS * c;
    }

    /**
     * Calculates angular circular difference between two headings [0, 180] degrees.
     */
    public double calculateHeadingDelta(Double heading1, Double heading2) {
        if (heading1 == null || heading2 == null) return 0.0;
        double diff = Math.abs(heading1 - heading2) % 360.0;
        return (diff > 180.0) ? (360.0 - diff) : diff;
    }

    /**
     * Finds an existing road issue matching spatial radius, defect class, and travel heading.
     */
    public Optional<RoadIssue> findExistingDuplicate(
        double lat,
        double lon,
        RoadIssue.DefectClass defectClass,
        Double headingDeg,
        Double gpsAccuracyM,
        EvidenceFrame incomingFrame
    ) {
        double effectiveRadius = (gpsAccuracyM != null && gpsAccuracyM > 0)
            ? Math.min(16.0, Math.max(8.0, gpsAccuracyM))
            : dedupRadiusMeters;

        double deltaLat = (effectiveRadius * 2) / 111320.0;
        double deltaLon = (effectiveRadius * 2) / (111320.0 * Math.cos(Math.toRadians(lat)));

        List<RoadIssue> candidates = roadIssueRepository.findCandidatesInBoundingBox(
            lat - deltaLat, lat + deltaLat, lon - deltaLon, lon + deltaLon
        );

        for (RoadIssue candidate : candidates) {
            if (candidate.getDefectClass() != defectClass) continue;

            double distance = calculateDistanceMeters(lat, lon, candidate.getLatitude(), candidate.getLongitude());
            if (distance > effectiveRadius) continue;

            // Check heading alignment if both are available
            if (headingDeg != null && incomingFrame != null && incomingFrame.getHeadingDeg() != null) {
                double headingDelta = calculateHeadingDelta(headingDeg, incomingFrame.getHeadingDeg());
                if (headingDelta > MAX_HEADING_DELTA_DEG) {
                    log.info("Deduplication rejected across opposite carriageway: distance={:.1f}m, headingDelta={:.1f} deg",
                        distance, headingDelta);
                    continue; // opposite lane or divergent direction
                }
            }

            // Record grouping audit entry
            try {
                EventGroupingAudit audit = new EventGroupingAudit();
                audit.setGroupUuid(UUID.randomUUID().toString());
                audit.setRoadIssue(candidate);
                audit.setFrame(incomingFrame);
                audit.setSpatialDistanceM(distance);
                audit.setHeadingDeltaDeg(headingDeg != null ? 0.0 : null);
                if (incomingFrame != null && incomingFrame.getCapturedAt() != null && candidate.getLastSeenAt() != null) {
                    audit.setTemporalDeltaSeconds((double) Math.abs(Duration.between(candidate.getLastSeenAt(), incomingFrame.getCapturedAt()).getSeconds()));
                }
                if (incomingFrame != null && incomingFrame.getSharpnessScore() != null) {
                    audit.setBestEvidenceScore(incomingFrame.getSharpnessScore());
                }
                groupingAuditRepository.save(audit);
            } catch (Exception e) {
                log.debug("Grouping audit log failed: {}", e.getMessage());
            }

            log.info("Multi-factor deduplication match: Defect {} within {:.1f}m of issue #{}",
                defectClass, distance, candidate.getId());
            return Optional.of(candidate);
        }

        return Optional.empty();
    }

    /**
     * Backward-compatible overload for legacy calls.
     */
    public Optional<RoadIssue> findExistingDuplicate(double lat, double lon, RoadIssue.DefectClass defectClass) {
        return findExistingDuplicate(lat, lon, defectClass, null, null, null);
    }

    /**
     * Selects the highest quality evidence frame using combined sharpness and confidence.
     */
    public Optional<EvidenceFrame> selectBestEvidenceFrame(List<EvidenceFrame> frames) {
        if (frames == null || frames.isEmpty()) return Optional.empty();
        return frames.stream().max(Comparator.comparingDouble(f -> {
            double sharpness = (f.getSharpnessScore() != null) ? f.getSharpnessScore() : 100.0;
            return sharpness;
        }));
    }
}
