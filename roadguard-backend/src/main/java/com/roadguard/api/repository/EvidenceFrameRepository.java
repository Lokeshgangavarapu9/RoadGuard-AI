package com.roadguard.api.repository;

import com.roadguard.api.entity.EvidenceFrame;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EvidenceFrameRepository extends JpaRepository<EvidenceFrame, Long> {
    Optional<EvidenceFrame> findByUuid(String uuid);
    List<EvidenceFrame> findByJourneyIdOrderByFrameSequenceAsc(Long journeyId);
    List<EvidenceFrame> findByInferenceStatus(EvidenceFrame.InferenceStatus status);
    long countByJourneyId(Long journeyId);
}
