package com.roadguard.api.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "gps_locations")
public class GpsLocation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "journey_id", nullable = false)
    private Journey journey;

    @Column(nullable = false)
    private Double latitude;

    @Column(nullable = false)
    private Double longitude;

    private Double altitude;
    private Double accuracy;    // metres, from browser
    private Double speed;       // m/s — NULL if browser did not supply
    private Double heading;     // degrees 0-360 — NULL if browser did not supply

    @Column(nullable = false)
    private Instant recordedAt;     // browser-supplied timestamp

    @Column(nullable = false)
    private Instant receivedAt = Instant.now();

    @Column(nullable = false)
    private Integer sequenceNum = 0;

    // ── Getters and setters ──
    public Long getId() { return id; }
    public Journey getJourney() { return journey; }
    public void setJourney(Journey journey) { this.journey = journey; }
    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }
    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }
    public Double getAltitude() { return altitude; }
    public void setAltitude(Double altitude) { this.altitude = altitude; }
    public Double getAccuracy() { return accuracy; }
    public void setAccuracy(Double accuracy) { this.accuracy = accuracy; }
    public Double getSpeed() { return speed; }
    public void setSpeed(Double speed) { this.speed = speed; }
    public Double getHeading() { return heading; }
    public void setHeading(Double heading) { this.heading = heading; }
    public Instant getRecordedAt() { return recordedAt; }
    public void setRecordedAt(Instant recordedAt) { this.recordedAt = recordedAt; }
    public Instant getReceivedAt() { return receivedAt; }
    public Integer getSequenceNum() { return sequenceNum; }
    public void setSequenceNum(Integer sequenceNum) { this.sequenceNum = sequenceNum; }
}
