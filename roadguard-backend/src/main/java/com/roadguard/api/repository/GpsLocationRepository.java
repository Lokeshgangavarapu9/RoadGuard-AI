package com.roadguard.api.repository;

import com.roadguard.api.entity.GpsLocation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GpsLocationRepository extends JpaRepository<GpsLocation, Long> {
    List<GpsLocation> findByJourneyIdOrderBySequenceNumAsc(Long journeyId);
    List<GpsLocation> findByJourneyIdOrderByRecordedAtAsc(Long journeyId);
    long countByJourneyId(Long journeyId);
}
