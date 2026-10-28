package com.roadguard.api;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class CorsConfigurationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("Should accept CORS preflight OPTIONS request with X-Session-ID from Vercel frontend")
    void testPreflightWithOptionsAndSessionId() throws Exception {
        mockMvc.perform(options("/api/v1/health")
                .header("Origin", "https://roadguard-frontend.vercel.app")
                .header("Access-Control-Request-Method", "GET")
                .header("Access-Control-Request-Headers", "x-session-id"))
            .andExpect(status().isOk())
            .andExpect(header().string("Access-Control-Allow-Origin", "https://roadguard-frontend.vercel.app"))
            .andExpect(header().exists("Access-Control-Allow-Headers"));
    }

    @Test
    @DisplayName("Should accept CORS GET request with X-Session-ID header from Vercel frontend")
    void testGetHealthWithSessionIdHeader() throws Exception {
        mockMvc.perform(get("/api/v1/health")
                .header("Origin", "https://roadguard-frontend.vercel.app")
                .header("X-Session-ID", "sess_test12345"))
            .andExpect(status().isOk())
            .andExpect(header().string("Access-Control-Allow-Origin", "https://roadguard-frontend.vercel.app"));
    }
}

