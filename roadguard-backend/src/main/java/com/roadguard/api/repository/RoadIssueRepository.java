package com.roadguard.api.repository;

import com.roadguard.api.entity.RoadIssue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoadIssueRepository extends JpaRepository<RoadIssue, Long> {
    Optional<RoadIssue> findByUuid(String uuid);
    List<RoadIssue> findByJourneyId(Long journeyId);
    List<RoadIssue> findByStatus(RoadIssue.IssueStatus status);
    List<RoadIssue> findAllByOrderByCreatedAtDesc();

    // Query candidates within approx bounding box for deduplication
    @Query("SELECT r FROM RoadIssue r WHERE r.latitude BETWEEN :minLat AND :maxLat AND r.longitude BETWEEN :minLon AND :maxLon AND r.status <> 'INVALID'")
    List<RoadIssue> findCandidatesInBoundingBox(
        @Param("minLat") double minLat,
        @Param("maxLat") double maxLat,
        @Param("minLon") double minLon,
        @Param("maxLon") double maxLon
    );

    long countByDefectClass(RoadIssue.DefectClass defectClass);
}
