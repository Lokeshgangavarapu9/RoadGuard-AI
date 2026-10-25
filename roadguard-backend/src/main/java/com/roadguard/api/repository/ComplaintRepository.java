package com.roadguard.api.repository;

import com.roadguard.api.entity.Complaint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ComplaintRepository extends JpaRepository<Complaint, Long> {
    Optional<Complaint> findByUuid(String uuid);
    List<Complaint> findByRoadIssueId(Long roadIssueId);
    List<Complaint> findByStatus(Complaint.ComplaintStatus status);
    List<Complaint> findAllByOrderByCreatedAtDesc();
}
