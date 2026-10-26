package com.roadguard.api.repository;

import com.roadguard.api.entity.FilingAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FilingAuditLogRepository extends JpaRepository<FilingAuditLog, Long> {
    List<FilingAuditLog> findByComplaintIdOrderByCreatedAtAsc(Long complaintId);
    List<FilingAuditLog> findByJobIdOrderByCreatedAtAsc(Long jobId);
}
