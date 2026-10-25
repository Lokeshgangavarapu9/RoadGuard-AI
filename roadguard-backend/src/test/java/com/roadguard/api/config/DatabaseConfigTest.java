package com.roadguard.api.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("DatabaseConfig URL Normalization and Safety Tests")
public class DatabaseConfigTest {

    @Test
    @DisplayName("Should normalize standard postgres:// URL from Render to jdbc:postgresql://")
    void testNormalizeRenderPostgresUrl() {
        String input = "postgres://roadguard_admin:secretPassword123@dpg-c123456789-a:5432/roadguard";
        DatabaseConfig.NormalizedDbConfig config = DatabaseConfig.normalize(input, null, null);

        assertEquals("jdbc:postgresql://dpg-c123456789-a:5432/roadguard", config.url());
        assertEquals("org.postgresql.Driver", config.driverClassName());
        assertEquals("roadguard_admin", config.username());
        assertEquals("secretPassword123", config.password());
        assertTrue(config.url().startsWith("jdbc:postgresql://"));
    }

    @Test
    @DisplayName("Should normalize postgresql:// URL with query parameters from Render to jdbc:postgresql://")
    void testNormalizePostgresqlWithQueryParams() {
        String input = "postgresql://roadguard_user:securePass@dpg-xyz_99.singapore-postgres.render.com:5432/roadguard_prod?sslmode=require&prepareThreshold=0";
        DatabaseConfig.NormalizedDbConfig config = DatabaseConfig.normalize(input, null, null);

        assertEquals("jdbc:postgresql://dpg-xyz_99.singapore-postgres.render.com:5432/roadguard_prod?sslmode=require&prepareThreshold=0", config.url());
        assertEquals("org.postgresql.Driver", config.driverClassName());
        assertEquals("roadguard_user", config.username());
        assertEquals("securePass", config.password());
        assertTrue(config.url().contains("sslmode=require"));
    }

    @Test
    @DisplayName("Should preserve standard jdbc:postgresql:// URL unchanged")
    void testPreserveStandardJdbcPostgresqlUrl() {
        String input = "jdbc:postgresql://localhost:5432/roadguard";
        DatabaseConfig.NormalizedDbConfig config = DatabaseConfig.normalize(input, "my_user", "my_pass");

        assertEquals("jdbc:postgresql://localhost:5432/roadguard", config.url());
        assertEquals("org.postgresql.Driver", config.driverClassName());
        assertEquals("my_user", config.username());
        assertEquals("my_pass", config.password());
    }

    @Test
    @DisplayName("Should handle complex passwords containing special characters like @, #, :, !")
    void testComplexPasswordWithSpecialCharacters() {
        String input = "postgres://roadguard_admin:p@ss:w#ord!@dpg-c123_a:5432/roadguard";
        DatabaseConfig.NormalizedDbConfig config = DatabaseConfig.normalize(input, null, null);

        assertEquals("jdbc:postgresql://dpg-c123_a:5432/roadguard", config.url());
        assertEquals("roadguard_admin", config.username());
        assertEquals("p@ss:w#ord!", config.password());
        assertFalse(config.url().contains("p@ss:w#ord!"));
    }

    @Test
    @DisplayName("Should prioritize separate username and password environment variables over default 'sa'")
    void testSeparateEnvVarsOverrideDefault() {
        String input = "postgres://dpg-c123456789-a:5432/roadguard";
        DatabaseConfig.NormalizedDbConfig config = DatabaseConfig.normalize(input, "custom_pg_user", "custom_pg_pass");

        assertEquals("jdbc:postgresql://dpg-c123456789-a:5432/roadguard", config.url());
        assertEquals("custom_pg_user", config.username());
        assertEquals("custom_pg_pass", config.password());
    }

    @Test
    @DisplayName("Should extract embedded credentials when raw username is default 'sa' or empty")
    void testEmbeddedCredentialsTakePrecedenceOverDefaultSa() {
        String input = "postgresql://prod_admin:prod_secret@dpg-internal:5432/roadguard";
        DatabaseConfig.NormalizedDbConfig config = DatabaseConfig.normalize(input, "sa", "");

        assertEquals("prod_admin", config.username());
        assertEquals("prod_secret", config.password());
    }

    @Test
    @DisplayName("Should fall back to local H2 in-memory when URL is null or empty")
    void testLocalH2FallbackOnEmpty() {
        DatabaseConfig.NormalizedDbConfig configNull = DatabaseConfig.normalize(null, null, null);
        assertTrue(configNull.url().startsWith("jdbc:h2:mem:"));
        assertEquals("org.h2.Driver", configNull.driverClassName());
        assertEquals("sa", configNull.username());

        DatabaseConfig.NormalizedDbConfig configEmpty = DatabaseConfig.normalize("   ", null, null);
        assertTrue(configEmpty.url().startsWith("jdbc:h2:mem:"));
    }

    @Test
    @DisplayName("Should preserve explicit jdbc:h2: configuration")
    void testExplicitH2Config() {
        String h2Url = "jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1";
        DatabaseConfig.NormalizedDbConfig config = DatabaseConfig.normalize(h2Url, "sa", "secret");

        assertEquals(h2Url, config.url());
        assertEquals("org.h2.Driver", config.driverClassName());
        assertEquals("sa", config.username());
        assertEquals("secret", config.password());
    }

    @Test
    @DisplayName("Should NEVER silently fall back to H2 when an invalid database URL is provided")
    void testInvalidUrlThrowsExceptionInsteadOfFallback() {
        assertThrows(IllegalArgumentException.class, () -> {
            DatabaseConfig.normalize("mysql://localhost:3306/db", null, null);
        });

        assertThrows(IllegalArgumentException.class, () -> {
            DatabaseConfig.normalize("invalid-url-protocol", null, null);
        });

        assertThrows(IllegalArgumentException.class, () -> {
            DatabaseConfig.normalize("postgres://", null, null);
        });
    }

    @Test
    @DisplayName("Should safely sanitize database URLs without logging passwords")
    void testSanitizeUrlMasksPassword() {
        String raw = "postgres://roadguard_admin:superSecretPassword@dpg-xxxx:5432/roadguard";
        String sanitized = DatabaseConfig.sanitizeUrl(raw);

        assertFalse(sanitized.contains("superSecretPassword"));
        assertTrue(sanitized.contains("roadguard"));
    }
}
