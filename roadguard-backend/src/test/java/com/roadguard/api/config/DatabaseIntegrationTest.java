package com.roadguard.api.config;

import com.roadguard.api.dto.HealthResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@DisplayName("Database and Flyway Integration Test")
public class DatabaseIntegrationTest {

    @Autowired
    private DataSource dataSource;

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    @DisplayName("DataSource and Flyway migrations should initialize successfully and create core tables")
    void testDataSourceAndFlywayInitialization() throws Exception {
        assertNotNull(dataSource, "DataSource bean should be initialized");

        try (Connection conn = dataSource.getConnection()) {
            assertFalse(conn.isClosed(), "Connection should be open");

            // Verify Flyway schema history table exists
            assertTrue(tableExists(conn, "flyway_schema_history"), "flyway_schema_history table should exist");

            // Verify core journeys table was created by V1 migration
            assertTrue(tableExists(conn, "journeys"), "journeys table should exist");

            // Verify road_issues table was created by V1 migration
            assertTrue(tableExists(conn, "road_issues"), "road_issues table should exist");
        }
    }

    private boolean tableExists(Connection conn, String tableName) throws Exception {
        try (ResultSet rs = conn.getMetaData().getTables(null, null, tableName.toUpperCase(), null)) {
            if (rs.next()) return true;
        }
        try (ResultSet rs = conn.getMetaData().getTables(null, null, tableName.toLowerCase(), null)) {
            if (rs.next()) return true;
        }
        try (ResultSet rs = conn.getMetaData().getTables(null, null, tableName, null)) {
            if (rs.next()) return true;
        }
        return false;
    }

    @Test
    @DisplayName("/api/v1/health should return UP and report active database engine dynamically")
    void testHealthEndpointReportsDatabaseDynamically() {
        ResponseEntity<HealthResponse> response = restTemplate.getForEntity("/api/v1/health", HealthResponse.class);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        HealthResponse body = response.getBody();
        assertNotNull(body);
        assertEquals("UP", body.getStatus());
        assertNotNull(body.getDatabase());
        assertTrue(body.getDatabase().contains("H2") || body.getDatabase().contains("PostgreSQL"),
            "Database should be dynamically reported (H2 or PostgreSQL)");
    }

    @Test
    @DisplayName("POST /api/v1/journeys should create journey and return 201 Created with valid ID")
    void testCreateJourneyRegression() {
        com.roadguard.api.dto.CreateJourneyRequest req = new com.roadguard.api.dto.CreateJourneyRequest();
        req.setVehicleType(com.roadguard.api.entity.Journey.VehicleType.CAR);
        req.setRiderName("Lokesh Kumar");
        req.setRiderEmail("lokesh@roadguard.local");
        req.setStartLatitude(16.5062);
        req.setStartLongitude(80.6480);
        req.setStartAddress("Vijayawada NH-16 Corridor, Andhra Pradesh");
        req.setDemoMode(true);
        req.setDemoSource("NH-16 Vijayawada-Guntur Simulation");

        ResponseEntity<com.roadguard.api.dto.JourneyResponse> response = restTemplate.postForEntity(
            "/api/v1/journeys",
            req,
            com.roadguard.api.dto.JourneyResponse.class
        );

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        com.roadguard.api.dto.JourneyResponse jBody = response.getBody();
        assertNotNull(jBody);
        assertNotNull(jBody.getId(), "Created journey should have non-null ID");
        assertEquals(com.roadguard.api.entity.Journey.JourneyStatus.ACTIVE, jBody.getStatus());
        assertEquals("Lokesh Kumar", jBody.getRiderName());
    }
}
