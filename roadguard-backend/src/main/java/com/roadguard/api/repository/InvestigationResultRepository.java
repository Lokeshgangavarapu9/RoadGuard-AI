package com.roadguard.api.repository;

import com.roadguard.api.entity.InvestigationResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface InvestigationResultRepository extends JpaRepository<InvestigationResult, Long> {
    Optional<InvestigationResult> findByRoadIssueId(Long roadIssueId);
}
