package com.roadguard.api.entity;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * Citizen profile holding contact, address, jurisdiction, vehicle registration details,
 * and complaint preferences for autonomous government filing.
 */
@Entity
@Table(name = "user_profiles")
public class UserProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String fullName;

    @Column(nullable = false, length = 200)
    private String email;

    @Column(nullable = false, length = 25)
    private String phone;

    @Column(length = 30)
    private String preferredLanguage = "English";

    @Column(nullable = false)
    private Boolean mobileVerified = false;

    @Column(nullable = false)
    private Boolean emailVerified = false;

    // ── Address & Jurisdiction (for local municipal authority matching) ──
    @Column(length = 500)
    private String address;

    @Column(length = 100)
    private String state = "Andhra Pradesh";

    @Column(length = 100)
    private String district;

    @Column(length = 150)
    private String cityOrMunicipality;

    @Column(length = 150)
    private String ulbName;

    @Column(length = 50)
    private String wardNumber;

    @Column(length = 150)
    private String locality;

    @Column(length = 20)
    private String pinCode;

    // ── Vehicle Details ──
    @Column(length = 50)
    private String primaryVrn;

    @Column(length = 50)
    private String primaryVrnNormalized;

    @Column(length = 20)
    private String vehicleType = "CAR";

    @Column(length = 1000)
    private String additionalVehicles;

    // ── Complaint & Privacy Preferences ──
    @Column(length = 30)
    private String preferredNotificationChannel = "SMS";

    @Column(nullable = false)
    private Boolean consentDeviceLocation = true;

    @Column(nullable = false)
    private Boolean consentInspectionPhotos = true;

    @Column(length = 500)
    private String communicationPreferences;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    @Column(nullable = false)
    private Instant updatedAt = Instant.now();

    public UserProfile() {}

    public UserProfile(String fullName, String email, String phone) {
        this.fullName = fullName;
        this.email = email;
        this.phone = phone;
    }

    public static String normalizeVrn(String vrn) {
        if (vrn == null) return null;
        return vrn.toUpperCase().replaceAll("[^A-Z0-9]", "");
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getPhoneNumber() { return phone; }
    public void setPhoneNumber(String phoneNumber) { 
        if (phoneNumber != null && !phoneNumber.trim().isEmpty()) {
            this.phone = phoneNumber; 
        }
    }

    public String getPreferredLanguage() { return preferredLanguage; }
    public void setPreferredLanguage(String preferredLanguage) { this.preferredLanguage = preferredLanguage; }

    public Boolean getMobileVerified() { return mobileVerified; }
    public void setMobileVerified(Boolean mobileVerified) { this.mobileVerified = mobileVerified != null ? mobileVerified : false; }

    public Boolean getEmailVerified() { return emailVerified; }
    public void setEmailVerified(Boolean emailVerified) { this.emailVerified = emailVerified != null ? emailVerified : false; }

    public boolean isRegistered() {
        return fullName != null && !fullName.trim().isEmpty() && email != null && !email.trim().isEmpty();
    }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public String getState() { return state; }
    public void setState(String state) { this.state = state; }

    public String getDistrict() { return district; }
    public void setDistrict(String district) { this.district = district; }

    public String getCityOrMunicipality() { return cityOrMunicipality; }
    public void setCityOrMunicipality(String cityOrMunicipality) { this.cityOrMunicipality = cityOrMunicipality; }

    public String getUlbName() { return ulbName; }
    public void setUlbName(String ulbName) { this.ulbName = ulbName; }

    public String getWardNumber() { return wardNumber; }
    public void setWardNumber(String wardNumber) { this.wardNumber = wardNumber; }

    public String getLocality() { return locality; }
    public void setLocality(String locality) { this.locality = locality; }

    public String getPinCode() { return pinCode; }
    public void setPinCode(String pinCode) { this.pinCode = pinCode; }

    public String getPrimaryVrn() { return primaryVrn; }
    public void setPrimaryVrn(String primaryVrn) {
        this.primaryVrn = primaryVrn;
        this.primaryVrnNormalized = normalizeVrn(primaryVrn);
    }

    public String getPrimaryVrnNormalized() { return primaryVrnNormalized; }
    public void setPrimaryVrnNormalized(String primaryVrnNormalized) { this.primaryVrnNormalized = primaryVrnNormalized; }

    public String getVehicleType() { return vehicleType; }
    public void setVehicleType(String vehicleType) { this.vehicleType = vehicleType; }

    public String getAdditionalVehicles() { return additionalVehicles; }
    public void setAdditionalVehicles(String additionalVehicles) { this.additionalVehicles = additionalVehicles; }

    public String getPreferredNotificationChannel() { return preferredNotificationChannel; }
    public void setPreferredNotificationChannel(String preferredNotificationChannel) { this.preferredNotificationChannel = preferredNotificationChannel; }

    public Boolean getConsentDeviceLocation() { return consentDeviceLocation; }
    public void setConsentDeviceLocation(Boolean consentDeviceLocation) { this.consentDeviceLocation = consentDeviceLocation != null ? consentDeviceLocation : true; }

    public Boolean getConsentInspectionPhotos() { return consentInspectionPhotos; }
    public void setConsentInspectionPhotos(Boolean consentInspectionPhotos) { this.consentInspectionPhotos = consentInspectionPhotos != null ? consentInspectionPhotos : true; }

    public String getCommunicationPreferences() { return communicationPreferences; }
    public void setCommunicationPreferences(String communicationPreferences) { this.communicationPreferences = communicationPreferences; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
