package com.roadguard.api.repository;

import com.roadguard.api.entity.EventGroupingAudit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EventGroupingAuditRepository extends JpaRepository<EventGroupingAudit, Long> {
    List<EventGroupingAudit> findByRoadIssueId(Long roadIssueId);
}
