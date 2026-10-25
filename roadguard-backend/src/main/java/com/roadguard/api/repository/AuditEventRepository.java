package com.roadguard.api.repository;

import com.roadguard.api.entity.AuditEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AuditEventRepository extends JpaRepository<AuditEvent, Long> {
    List<AuditEvent> findByEntityTypeAndEntityId(String entityType, String entityId);
    List<AuditEvent> findTop50ByOrderByCreatedAtDesc();
}
