package com.roadguard.api.repository;

import com.roadguard.api.entity.Journey;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface JourneyRepository extends JpaRepository<Journey, Long> {
    Optional<Journey> findByUuid(String uuid);
    List<Journey> findAllByOrderByCreatedAtDesc();
    List<Journey> findByStatus(Journey.JourneyStatus status);
}
