package com.roadguard.api.repository;

import com.roadguard.api.entity.ContractorRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ContractorRecordRepository extends JpaRepository<ContractorRecord, Long> {
    List<ContractorRecord> findByAuthorityId(Long authorityId);

    @Query("SELECT c FROM ContractorRecord c WHERE LOWER(c.roadName) LIKE LOWER(CONCAT('%', :roadName, '%'))")
    List<ContractorRecord> findByRoadNameContainingIgnoreCase(@Param("roadName") String roadName);
}
