package com.roadguard.api.controller;

import com.roadguard.api.entity.ConnectedPortal;
import com.roadguard.api.entity.UserProfile;
import com.roadguard.api.service.UserProfileService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/profile")
public class UserProfileController {

    private final UserProfileService profileService;

    public UserProfileController(UserProfileService profileService) {
        this.profileService = profileService;
    }

    @GetMapping
    public ResponseEntity<UserProfile> getProfile() {
        return ResponseEntity.ok(profileService.getProfile());
    }

    @PutMapping
    public ResponseEntity<UserProfile> updateProfile(@RequestBody UserProfile request) {
        return ResponseEntity.ok(profileService.updateProfile(request));
    }

    @GetMapping("/connected-services")
    public ResponseEntity<List<ConnectedPortal>> getConnectedPortals() {
        return ResponseEntity.ok(profileService.getConnectedPortals());
    }

    @PostMapping("/connected-services/{portalId}/test-connection")
    public ResponseEntity<ConnectedPortal> testPortalConnection(@PathVariable String portalId) {
        return ResponseEntity.ok(profileService.checkPortalStatus(portalId));
    }
}
