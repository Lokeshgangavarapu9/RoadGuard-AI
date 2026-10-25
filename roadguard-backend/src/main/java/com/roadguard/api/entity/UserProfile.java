package com.roadguard.api.entity;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * Citizen profile holding contact, address, and primary/additional vehicle registration details.
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

    @Column(length = 500)
    private String address;

    @Column(length = 50)
    private String primaryVrn;

    @Column(length = 50)
    private String primaryVrnNormalized;

    @Column(length = 20)
    private String vehicleType = "CAR";

    @Column(length = 1000)
    private String additionalVehicles;

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

    public boolean isRegistered() {
        return fullName != null && !fullName.trim().isEmpty() && email != null && !email.trim().isEmpty();
    }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

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

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
