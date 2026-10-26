package com.roadguard.api.repository;

import com.roadguard.api.entity.AutomationJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AutomationJobRepository extends JpaRepository<AutomationJob, Long> {
    Optional<AutomationJob> findByUuid(String uuid);
    List<AutomationJob> findByStatusOrderByCreatedAtAsc(AutomationJob.JobStatus status);
    List<AutomationJob> findByComplaintIdOrderByCreatedAtDesc(Long complaintId);
    Optional<AutomationJob> findFirstByComplaintIdOrderByCreatedAtDesc(Long complaintId);
}
