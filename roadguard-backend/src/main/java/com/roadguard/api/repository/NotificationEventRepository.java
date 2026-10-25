package com.roadguard.api.repository;

import com.roadguard.api.entity.NotificationEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotificationEventRepository extends JpaRepository<NotificationEvent, Long> {
    List<NotificationEvent> findByReferenceIdAndReferenceType(Long referenceId, String referenceType);
    List<NotificationEvent> findBySentFalse();
}
