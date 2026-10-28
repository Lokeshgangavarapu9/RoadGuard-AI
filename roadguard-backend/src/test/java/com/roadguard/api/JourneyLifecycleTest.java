package com.roadguard.api;

import com.roadguard.api.dto.CreateJourneyRequest;
import com.roadguard.api.dto.GpsBatchRequest;
import com.roadguard.api.dto.GpsPointDto;
import com.roadguard.api.dto.JourneyResponse;
import com.roadguard.api.entity.GpsLocation;
import com.roadguard.api.entity.Journey;
import com.roadguard.api.repository.GpsLocationRepository;
import com.roadguard.api.repository.JourneyRepository;
import com.roadguard.api.service.JourneyService;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@TestPropertySource(properties = {
    "spring.datasource.url=jdbc:h2:mem:journeytestdb;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
    "spring.flyway.enabled=true",
    "spring.flyway.clean-disabled=false",
    "roadguard.inference.mode=MOCK",
    "roadguard.mail.enabled=false"
})
public class JourneyLifecycleTest {

    @Autowired
    private JourneyService journeyService;

    @Autowired
    private JourneyRepository journeyRepository;

    @Autowired
    private GpsLocationRepository gpsLocationRepository;

    private Long journey1Id;
    private Long journey2Id;

    @Test
    @Order(1)
    void testCreateJourneyWithGenuineStartCoordinates() {
        CreateJourneyRequest req = new CreateJourneyRequest();
        req.setVehicleType(Journey.VehicleType.CAR);
        req.setRiderName("Lokesh Gangavarapu");
        req.setRiderEmail("lokesh@roadguard.test");
        req.setStartLatitude(16.5062);
        req.setStartLongitude(80.6480);
        req.setStartAddress("Benz Circle, Vijayawada");

        JourneyResponse resp = journeyService.createJourney(req);
        assertNotNull(resp);
        assertNotNull(resp.getId());
        assertEquals(Journey.VehicleType.CAR, resp.getVehicleType());
        assertEquals(16.5062, resp.getStartLatitude(), 0.0001);
        assertEquals(80.6480, resp.getStartLongitude(), 0.0001);
        assertEquals(Journey.JourneyStatus.ACTIVE, resp.getStatus());

        journey1Id = resp.getId();

        // Also create a second journey to verify isolation on delete
        CreateJourneyRequest req2 = new CreateJourneyRequest();
        req2.setVehicleType(Journey.VehicleType.BIKE);
        req2.setRiderName("Control Subject");
        req2.setStartLatitude(17.3850);
        req2.setStartLongitude(78.4867);
        JourneyResponse resp2 = journeyService.createJourney(req2);
        journey2Id = resp2.getId();
    }

    @Test
    @Order(2)
    void testAddGpsBatchWithVaryingAccuracies() {
        assertNotNull(journey1Id);

        // Add 3 GPS points: 12m (high accuracy), 97m (approximate), 149m (coarse)
        GpsPointDto p1 = new GpsPointDto();
        p1.setLatitude(16.5062);
        p1.setLongitude(80.6480);
        p1.setAccuracy(12.0);
        p1.setSpeed(8.5);
        p1.setHeading(45.0);
        p1.setRecordedAt(Instant.now().minusSeconds(10));
        p1.setSequenceNum(1);

        GpsPointDto p2 = new GpsPointDto();
        p2.setLatitude(16.5075);
        p2.setLongitude(80.6495);
        p2.setAccuracy(97.0);
        p2.setSpeed(9.2);
        p2.setHeading(50.0);
        p2.setRecordedAt(Instant.now().minusSeconds(5));
        p2.setSequenceNum(2);

        GpsPointDto p3 = new GpsPointDto();
        p3.setLatitude(16.5090);
        p3.setLongitude(80.6510);
        p3.setAccuracy(149.0);
        p3.setSpeed(10.1);
        p3.setHeading(55.0);
        p3.setRecordedAt(Instant.now());
        p3.setSequenceNum(3);

        GpsBatchRequest batch = new GpsBatchRequest();
        batch.setPoints(Arrays.asList(p1, p2, p3));

        List<GpsLocation> saved = journeyService.addGpsBatch(journey1Id, batch);
        assertEquals(3, saved.size());
        assertEquals(12.0, saved.get(0).getAccuracy());
        assertEquals(97.0, saved.get(1).getAccuracy());
        assertEquals(149.0, saved.get(2).getAccuracy());

        // Verify retrieval order
        List<GpsLocation> persisted = gpsLocationRepository.findByJourneyIdOrderBySequenceNumAsc(journey1Id);
        assertEquals(3, persisted.size());
        assertEquals(1, persisted.get(0).getSequenceNum());
        assertEquals(2, persisted.get(1).getSequenceNum());
        assertEquals(3, persisted.get(2).getSequenceNum());
    }

    @Test
    @Order(3)
    void testStopJourneyComputesDistance() {
        assertNotNull(journey1Id);
        // Simulate that journey recorded frames
        Journey j = journeyRepository.findById(journey1Id).orElseThrow();
        j.setTotalFrames(5);
        journeyRepository.save(j);

        JourneyResponse stopped = journeyService.stopJourney(journey1Id, null);
        assertEquals(Journey.JourneyStatus.STOPPED, stopped.getStatus());
        assertNotNull(stopped.getDistanceMeters());
        assertTrue(stopped.getDistanceMeters() > 100.0, "Distance should be computed across genuine coordinates");
        assertEquals(16.5090, stopped.getEndLatitude(), 0.0001);
    }

    @Test
    @Order(4)
    void testDeleteJourneyCascadesExclusivelyToOwnRecords() {
        assertNotNull(journey1Id);
        assertNotNull(journey2Id);

        // Before delete: journey1 has 3 GPS points, journey2 exists
        assertEquals(3, gpsLocationRepository.findByJourneyIdOrderBySequenceNumAsc(journey1Id).size());
        assertTrue(journeyRepository.findById(journey1Id).isPresent());
        assertTrue(journeyRepository.findById(journey2Id).isPresent());

        // Delete journey 1
        journeyService.deleteJourney(journey1Id);

        // Verify journey 1 is gone along with its GPS points
        assertFalse(journeyRepository.findById(journey1Id).isPresent(), "Journey 1 must be deleted");
        assertEquals(0, gpsLocationRepository.findByJourneyIdOrderBySequenceNumAsc(journey1Id).size(), "Journey 1 GPS points must be deleted");

        // Verify journey 2 is untouched
        assertTrue(journeyRepository.findById(journey2Id).isPresent(), "Journey 2 must remain completely intact");
    }
}
