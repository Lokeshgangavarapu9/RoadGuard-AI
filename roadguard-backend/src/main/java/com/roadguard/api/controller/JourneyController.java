package com.roadguard.api.controller;

import com.roadguard.api.dto.*;
import com.roadguard.api.entity.EvidenceFrame;
import com.roadguard.api.entity.GpsLocation;
import com.roadguard.api.repository.EvidenceFrameRepository;
import com.roadguard.api.repository.GpsLocationRepository;
import com.roadguard.api.service.JourneyService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/journeys")
public class JourneyController {

    private final JourneyService journeyService;
    private final GpsLocationRepository gpsLocationRepository;
    private final EvidenceFrameRepository evidenceFrameRepository;

    public JourneyController(
        JourneyService journeyService,
        GpsLocationRepository gpsLocationRepository,
        EvidenceFrameRepository evidenceFrameRepository
    ) {
        this.journeyService = journeyService;
        this.gpsLocationRepository = gpsLocationRepository;
        this.evidenceFrameRepository = evidenceFrameRepository;
    }

    @PostMapping
    public ResponseEntity<JourneyResponse> createJourney(@Valid @RequestBody CreateJourneyRequest req) {
        JourneyResponse resp = journeyService.createJourney(req);
        return ResponseEntity.status(HttpStatus.CREATED).body(resp);
    }

    @GetMapping
    public ResponseEntity<List<JourneyResponse>> listJourneys() {
        return ResponseEntity.ok(journeyService.getAllJourneys());
    }

    @GetMapping("/{id}")
    public ResponseEntity<JourneyResponse> getJourney(@PathVariable Long id) {
        return ResponseEntity.ok(journeyService.getJourneyById(id));
    }

    @PostMapping("/{id}/stop")
    public ResponseEntity<JourneyResponse> stopJourney(
        @PathVariable Long id,
        @RequestBody(required = false) StopJourneyRequest req
    ) {
        return ResponseEntity.ok(journeyService.stopJourney(id, req));
    }

    @PostMapping("/{id}/gps")
    public ResponseEntity<List<GpsLocation>> addGpsTelemetry(
        @PathVariable Long id,
        @Valid @RequestBody GpsBatchRequest req
    ) {
        List<GpsLocation> saved = journeyService.addGpsBatch(id, req);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @GetMapping("/{id}/gps")
    public ResponseEntity<List<GpsLocation>> getGpsTelemetry(@PathVariable Long id) {
        return ResponseEntity.ok(gpsLocationRepository.findByJourneyIdOrderBySequenceNumAsc(id));
    }

    @PostMapping(value = "/{id}/frames", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<EvidenceFrameResponse> uploadFrame(
        @PathVariable Long id,
        @RequestParam("file") MultipartFile file,
        @RequestParam(value = "latitude", required = false) Double latitude,
        @RequestParam(value = "longitude", required = false) Double longitude,
        @RequestParam(value = "capturedAt", required = false) Instant capturedAt,
        @RequestParam(value = "frameSequence", required = false) Integer frameSequence,
        @RequestParam(value = "accuracy", required = false) Double accuracy,
        @RequestParam(value = "heading", required = false) Double heading,
        @RequestParam(value = "speed", required = false) Double speed,
        @RequestParam(value = "sha256", required = false) String clientSha256
    ) throws IOException {
        EvidenceFrameResponse resp = journeyService.uploadEvidenceFrame(
            id, file, latitude, longitude, capturedAt, frameSequence, accuracy, heading, speed, clientSha256);
        return ResponseEntity.status(HttpStatus.CREATED).body(resp);
    }

    @GetMapping("/{id}/frames")
    public ResponseEntity<List<EvidenceFrameResponse>> getFrames(@PathVariable Long id) {
        List<EvidenceFrame> frames = evidenceFrameRepository.findByJourneyIdOrderByFrameSequenceAsc(id);
        List<EvidenceFrameResponse> resp = frames.stream()
            .map(f -> EvidenceFrameResponse.fromEntity(f, 1))
            .collect(Collectors.toList());
        return ResponseEntity.ok(resp);
    }
}
