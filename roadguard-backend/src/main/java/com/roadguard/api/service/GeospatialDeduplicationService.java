package com.roadguard.api.service;

import com.roadguard.api.entity.RoadIssue;
import com.roadguard.api.repository.RoadIssueRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class GeospatialDeduplicationService {

    private static final Logger log = LoggerFactory.getLogger(GeospatialDeduplicationService.class);

    private static final double EARTH_RADIUS_METERS = 6371000.0;

    @Value("${roadguard.geospatial.dedup-radius-metres:15.0}")
    private double dedupRadiusMeters;

    private final RoadIssueRepository roadIssueRepository;

    public GeospatialDeduplicationService(RoadIssueRepository roadIssueRepository) {
        this.roadIssueRepository = roadIssueRepository;
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
     * Finds an existing road issue within the deduplication radius (default 15m)
     * matching the same defect class.
     */
    public Optional<RoadIssue> findExistingDuplicate(double lat, double lon, RoadIssue.DefectClass defectClass) {
        // Compute rough bounding box (~111 km per latitude degree, ~0.0002 deg is ~22m)
        double deltaLat = (dedupRadiusMeters * 2) / 111320.0;
        double deltaLon = (dedupRadiusMeters * 2) / (111320.0 * Math.cos(Math.toRadians(lat)));

        List<RoadIssue> candidates = roadIssueRepository.findCandidatesInBoundingBox(
            lat - deltaLat, lat + deltaLat, lon - deltaLon, lon + deltaLon
        );

        for (RoadIssue candidate : candidates) {
            if (candidate.getDefectClass() == defectClass) {
                double distance = calculateDistanceMeters(lat, lon, candidate.getLatitude(), candidate.getLongitude());
                if (distance <= dedupRadiusMeters) {
                    log.info("Spatial deduplication match: Defect {} within {:.1f}m of existing issue #{}",
                        defectClass, distance, candidate.getId());
                    return Optional.of(candidate);
                }
            }
        }

        return Optional.empty();
    }
}
