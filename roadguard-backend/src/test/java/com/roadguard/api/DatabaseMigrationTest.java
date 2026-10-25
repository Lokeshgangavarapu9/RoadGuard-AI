package com.roadguard.api;

import com.roadguard.api.entity.ConnectedPortal;
import com.roadguard.api.entity.UserProfile;
import com.roadguard.api.repository.UserProfileRepository;
import com.roadguard.api.service.UserProfileService;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@TestPropertySource(properties = {
    "spring.datasource.url=jdbc:h2:mem:migrationtestdb;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
    "spring.flyway.enabled=true",
    "spring.flyway.clean-disabled=false",
    "roadguard.inference.mode=MOCK",
    "roadguard.mail.enabled=false"
})
public class DatabaseMigrationTest {

    @Autowired
    private UserProfileService profileService;

    @Autowired
    private UserProfileRepository profileRepository;

    @Test
    @Order(1)
    void contextLoadsAndFlywayMigrates() {
        System.out.println("Spring Boot ApplicationContext and Flyway migrations loaded successfully.");
        // After V3 runs, seeded demo profile should be cleaned up
        assertTrue(profileRepository.findAll().isEmpty(), "User profiles should be empty after V3 cleanup");
    }

    @Test
    @Order(2)
    void testMissingProfileReturnsSafeEmptyObjectWithoutFakeCitizen() {
        UserProfile emptyProfile = profileService.getProfile();
        assertNotNull(emptyProfile, "Profile response must never be null");
        assertNull(emptyProfile.getId(), "Empty profile should not have persisted ID");
        assertEquals("", emptyProfile.getFullName(), "Full name must be empty string, not fake citizen");
        assertEquals("", emptyProfile.getEmail(), "Email must be empty string");
        assertEquals("", emptyProfile.getPhone(), "Phone must be empty string");
        assertFalse(emptyProfile.isRegistered(), "Missing profile must report registered=false");
        // Verify database is still clean and no fake citizen was persisted in read-only transaction
        assertEquals(0, profileRepository.count(), "No record should be inserted by getProfile");
    }

    @Test
    @Order(3)
    void testSaveNewGenuineCitizenProfile() {
        UserProfile newProfile = new UserProfile();
        newProfile.setFullName("K. S. Rao");
        newProfile.setEmail("ksrao.citizen@ap.gov.in");
        newProfile.setPhoneNumber("+91 94401 23456");
        newProfile.setAddress("Plot 24, Bandar Road, Labbipet, Vijayawada, AP");
        newProfile.setPrimaryVrn("AP 16 CK 9988");
        newProfile.setVehicleType("SUV");
        newProfile.setAdditionalVehicles("AP 16 XY 1122 (Two-Wheeler)");

        UserProfile saved = profileService.updateProfile(newProfile);

        assertNotNull(saved.getId(), "Saved profile must have a generated ID");
        assertEquals("K. S. Rao", saved.getFullName());
        assertEquals("ksrao.citizen@ap.gov.in", saved.getEmail());
        assertEquals("+91 94401 23456", saved.getPhone());
        assertEquals("+91 94401 23456", saved.getPhoneNumber());
        assertEquals("AP16CK9988", saved.getPrimaryVrnNormalized());
        assertTrue(saved.isRegistered());

        // Verify retrieval matches persisted record
        UserProfile retrieved = profileService.getProfile();
        assertNotNull(retrieved.getId());
        assertEquals("K. S. Rao", retrieved.getFullName());
        assertEquals("AP16CK9988", retrieved.getPrimaryVrnNormalized());
    }

    @Test
    @Order(4)
    void testUpdateExistingProfilePersistsChanges() {
        UserProfile updateReq = new UserProfile();
        updateReq.setFullName("K. S. Rao");
        updateReq.setEmail("ksrao.updated@ap.gov.in");
        updateReq.setPhone("+91 94401 99999");
        updateReq.setAddress("Plot 24, Bandar Road, Labbipet, Vijayawada, AP - Updated");
        updateReq.setPrimaryVrn("AP 16 CK 9988");
        updateReq.setVehicleType("SUV");

        UserProfile updated = profileService.updateProfile(updateReq);

        assertEquals("ksrao.updated@ap.gov.in", updated.getEmail());
        assertEquals("+91 94401 99999", updated.getPhone());
        assertEquals("+91 94401 99999", updated.getPhoneNumber());

        UserProfile retrieved = profileService.getProfile();
        assertEquals("ksrao.updated@ap.gov.in", retrieved.getEmail());
        assertEquals("+91 94401 99999", retrieved.getPhone());
    }

    @Test
    @Order(5)
    void testValidationRejectsInvalidProfileData() {
        UserProfile invalid = new UserProfile();
        invalid.setFullName(""); // Blank name
        invalid.setEmail("test@email.com");
        invalid.setPhone("+91 9876543210");
        assertThrows(IllegalArgumentException.class, () -> profileService.updateProfile(invalid));

        invalid.setFullName("Valid Name");
        invalid.setEmail("not-an-email"); // Missing @
        assertThrows(IllegalArgumentException.class, () -> profileService.updateProfile(invalid));

        invalid.setEmail("valid@email.com");
        invalid.setPhone("123"); // Too short phone (< 10 digits)
        assertThrows(IllegalArgumentException.class, () -> profileService.updateProfile(invalid));
    }

    @Test
    @Order(6)
    void testConnectedPortalsRetrievalAndTruthfulStatuses() {
        List<ConnectedPortal> portals = profileService.getConnectedPortals();
        assertNotNull(portals);
        assertEquals(3, portals.size(), "Should have exactly 3 official government portals seeded");

        ConnectedPortal nhai = portals.stream()
            .filter(p -> "RAJMARGYATRA_NHAI".equals(p.getPortalId()))
            .findFirst()
            .orElseThrow();
        assertEquals("MANUAL_HANDOFF_ONLY", nhai.getStatus().name());
        assertEquals("https://rajmargyatra.nhai.gov.in/complaints", nhai.getOfficialUrl());

        ConnectedPortal cdma = portals.stream()
            .filter(p -> "AP_CDMA".equals(p.getPortalId()))
            .findFirst()
            .orElseThrow();
        assertEquals("MANUAL_HANDOFF_ONLY", cdma.getStatus().name());
        assertEquals("https://cdma.ap.gov.in/services/grievances/", cdma.getOfficialUrl());

        ConnectedPortal meekosam = portals.stream()
            .filter(p -> "AP_MEEKOSAM_PGRS".equals(p.getPortalId()))
            .findFirst()
            .orElseThrow();
        assertEquals("MANUAL_HANDOFF_ONLY", meekosam.getStatus().name());
        assertEquals("https://meekosam.ap.gov.in/", meekosam.getOfficialUrl());
    }

    @Test
    @Order(7)
    void testAntiMockGuardPurgesFabricatedDemoProfile() {
        profileRepository.deleteAll();

        // Manually simulate a legacy database containing the seeded mock demo identity
        UserProfile legacyMock = new UserProfile();
        legacyMock.setFullName("Lokesh Kumar");
        legacyMock.setEmail("lokesh.citizen@roadguard.local");
        legacyMock.setPhone("+91 98765 43210");
        legacyMock.setAddress("Door 4-12, Ring Road, Benz Circle, Vijayawada, Andhra Pradesh - 520010");
        legacyMock.setPrimaryVrn("AP 16 AB 1234");
        legacyMock.setVehicleType("CAR");
        legacyMock.setAdditionalVehicles("AP 16 XY 9876 (Two-Wheeler)");
        profileRepository.save(legacyMock);

        assertEquals(1, profileRepository.count(), "Legacy mock record should be present in DB");

        // getProfile() must intercept, purge the mock record, and return safe empty profile
        UserProfile sanitized = profileService.getProfile();
        assertNotNull(sanitized);
        assertNull(sanitized.getId());
        assertEquals("", sanitized.getFullName(), "Full name must be sanitized to empty string");
        assertEquals("", sanitized.getEmail(), "Email must be sanitized to empty string");
        assertFalse(sanitized.isRegistered(), "Sanitized profile must not report registered");

        // Verify it was purged from the database
        assertEquals(0, profileRepository.count(), "Legacy mock record must be deleted from DB");
    }
}
