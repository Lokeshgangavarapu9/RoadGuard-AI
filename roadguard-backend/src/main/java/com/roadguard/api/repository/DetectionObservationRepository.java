package com.roadguard.api.repository;

import com.roadguard.api.entity.DetectionObservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DetectionObservationRepository extends JpaRepository<DetectionObservation, Long> {
    List<DetectionObservation> findByFrameId(Long frameId);
    List<DetectionObservation> findByRoadIssueId(Long roadIssueId);
}
