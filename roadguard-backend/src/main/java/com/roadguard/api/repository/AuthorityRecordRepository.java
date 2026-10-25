package com.roadguard.api.repository;

import com.roadguard.api.entity.AuthorityRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AuthorityRecordRepository extends JpaRepository<AuthorityRecord, Long> {
    Optional<AuthorityRecord> findByDeptCode(String deptCode);
}
