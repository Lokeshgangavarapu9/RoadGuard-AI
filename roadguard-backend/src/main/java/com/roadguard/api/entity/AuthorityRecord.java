package com.roadguard.api.entity;

import jakarta.persistence.*;


@Entity
@Table(name = "authority_records")
public class AuthorityRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String deptCode;

    @Column(nullable = false, length = 200)
    private String deptName;

    @Column(length = 100)
    private String jurisdiction;

    @Column(length = 500)
    private String portalUrl;

    @Column(length = 500)
    private String grievanceUrl;

    @Column(length = 100)
    private String helpline;

    @Column(length = 100)
    private String state = "Andhra Pradesh";

    @Column(length = 1000)
    private String notes;

    // ── Getters ──
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getDeptCode() { return deptCode; }
    public void setDeptCode(String deptCode) { this.deptCode = deptCode; }
    public String getDeptName() { return deptName; }
    public void setDeptName(String deptName) { this.deptName = deptName; }
    public String getName() { return deptName; }
    public void setName(String name) { this.deptName = name; }
    public String getJurisdiction() { return jurisdiction; }
    public void setJurisdiction(String jurisdiction) { this.jurisdiction = jurisdiction; }
    public String getPortalUrl() { return portalUrl; }
    public void setPortalUrl(String portalUrl) { this.portalUrl = portalUrl; }
    public String getGrievanceUrl() { return grievanceUrl; }
    public void setGrievanceUrl(String grievanceUrl) { this.grievanceUrl = grievanceUrl; }
    public String getHelpline() { return helpline; }
    public void setHelpline(String helpline) { this.helpline = helpline; }
    public String getState() { return state; }
    public void setState(String state) { this.state = state; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
