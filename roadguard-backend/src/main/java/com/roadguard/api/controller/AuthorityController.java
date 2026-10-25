package com.roadguard.api.controller;

import com.roadguard.api.entity.AuthorityRecord;
import com.roadguard.api.repository.AuthorityRecordRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/authorities")
public class AuthorityController {

    private final AuthorityRecordRepository authorityRepository;

    public AuthorityController(AuthorityRecordRepository authorityRepository) {
        this.authorityRepository = authorityRepository;
    }

    @GetMapping
    public ResponseEntity<List<AuthorityRecord>> listAuthorities() {
        return ResponseEntity.ok(authorityRepository.findAll());
    }

    @GetMapping("/{code}")
    public ResponseEntity<AuthorityRecord> getByCode(@PathVariable String code) {
        return authorityRepository.findByDeptCode(code.toUpperCase())
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }
}
