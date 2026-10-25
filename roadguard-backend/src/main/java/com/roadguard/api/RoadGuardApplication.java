package com.roadguard.api;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.env.Environment;

/**
 * RoadGuard AI — Spring Boot Application Entry Point.
 *
 * <p>Intelligent road-monitoring and AI-assisted public grievance
 * management system for Andhra Pradesh, India.</p>
 *
 * <p><b>Stage A (current):</b> H2 in-memory database, mock inference,
 * local file storage, simulated complaint submission.</p>
 *
 * <p><b>Stage B (planned):</b> PostgreSQL + PostGIS, ONNX/HTTP inference,
 * MinIO storage, assisted portal filing.</p>
 */
@SpringBootApplication
public class RoadGuardApplication {

    private static final Logger log = LoggerFactory.getLogger(RoadGuardApplication.class);

    public static void main(String[] args) {
        SpringApplication.run(RoadGuardApplication.class, args);
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onReady(ApplicationReadyEvent event) {
        Environment env = event.getApplicationContext().getEnvironment();
        String port = env.getProperty("server.port", "8080");
        String inferenceMode = env.getProperty("roadguard.inference.mode", "MOCK");
        String dbUrl = env.getProperty("spring.datasource.url", "unknown");
        String authEnabled = env.getProperty("roadguard.security.auth-enabled", "false");

        log.info("╔══════════════════════════════════════════════════════╗");
        log.info("║          RoadGuard AI — Backend Started              ║");
        log.info("╠══════════════════════════════════════════════════════╣");
        log.info("║  Health:     http://localhost:{}/api/v1/health     ║", port);
        log.info("║  H2 Console: http://localhost:{}/h2-console        ║", port);
        log.info("║  API Base:   http://localhost:{}/api/v1            ║", port);
        log.info("╠══════════════════════════════════════════════════════╣");
        log.info("║  DB:         {}  ║", dbUrl.substring(0, Math.min(dbUrl.length(), 45)));
        log.info("║  Inference:  {}                                   ║", inferenceMode);
        log.info("║  Auth:       {}                                  ║", authEnabled);
        log.info("╚══════════════════════════════════════════════════════╝");
    }
}
