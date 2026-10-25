package com.roadguard.api.repository;

import com.roadguard.api.entity.UserProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserProfileRepository extends JpaRepository<UserProfile, Long> {
    Optional<UserProfile> findFirstByOrderByIdAsc();
    Optional<UserProfile> findByEmail(String email);
    Optional<UserProfile> findByPrimaryVrnNormalized(String primaryVrnNormalized);
}
