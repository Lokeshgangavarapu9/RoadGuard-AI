package com.roadguard.api.entity;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * Represents a connected government grievance portal and its verified connection status.
 */
@Entity
@Table(name = "connected_portals")
public class ConnectedPortal {

    public enum ConnectionStatus {
        NOT_CONNECTED,
        LOGIN_REQUIRED,
        AWAITING_USER_VERIFICATION,
        CONNECTED_VERIFIED,
        SESSION_EXPIRED,
        CONNECTION_FAILED,
        PORTAL_UNAVAILABLE,
        MANUAL_HANDOFF_ONLY,
        API_UNAVAILABLE
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String portalId;

    @Column(nullable = false, length = 150)
    private String portalName;

    @Column(nullable = false, length = 300)
    private String officialUrl;

    @Column(nullable = false, length = 200)
    private String roadJurisdiction;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private ConnectionStatus status = ConnectionStatus.MANUAL_HANDOFF_ONLY;

    private Instant lastVerifiedAt = Instant.now();

    @Column(length = 1000)
    private String connectionNotes;

    public ConnectedPortal() {}

    public ConnectedPortal(String portalId, String portalName, String officialUrl, String roadJurisdiction, ConnectionStatus status, String connectionNotes) {
        this.portalId = portalId;
        this.portalName = portalName;
        this.officialUrl = officialUrl;
        this.roadJurisdiction = roadJurisdiction;
        this.status = status;
        this.connectionNotes = connectionNotes;
        this.lastVerifiedAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getPortalId() { return portalId; }
    public void setPortalId(String portalId) { this.portalId = portalId; }

    public String getPortalName() { return portalName; }
    public void setPortalName(String portalName) { this.portalName = portalName; }

    public String getOfficialUrl() { return officialUrl; }
    public void setOfficialUrl(String officialUrl) { this.officialUrl = officialUrl; }

    public String getRoadJurisdiction() { return roadJurisdiction; }
    public void setRoadJurisdiction(String roadJurisdiction) { this.roadJurisdiction = roadJurisdiction; }

    public ConnectionStatus getStatus() { return status; }
    public void setStatus(ConnectionStatus status) { this.status = status; }

    public Instant getLastVerifiedAt() { return lastVerifiedAt; }
    public void setLastVerifiedAt(Instant lastVerifiedAt) { this.lastVerifiedAt = lastVerifiedAt; }

    public String getConnectionNotes() { return connectionNotes; }
    public void setConnectionNotes(String connectionNotes) { this.connectionNotes = connectionNotes; }
}
