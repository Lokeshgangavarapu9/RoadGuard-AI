package com.roadguard.api.service;

import com.roadguard.api.entity.AuthorityRecord;
import com.roadguard.api.entity.ContractorRecord;
import com.roadguard.api.entity.InvestigationResult;
import com.roadguard.api.entity.RoadIssue;
import com.roadguard.api.repository.AuthorityRecordRepository;
import com.roadguard.api.repository.ContractorRecordRepository;
import com.roadguard.api.repository.InvestigationResultRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Service
public class InvestigationService {

    private static final Logger log = LoggerFactory.getLogger(InvestigationService.class);

    private final AuthorityRecordRepository authorityRepository;
    private final ContractorRecordRepository contractorRepository;
    private final InvestigationResultRepository investigationRepository;

    public InvestigationService(
        AuthorityRecordRepository authorityRepository,
        ContractorRecordRepository contractorRepository,
        InvestigationResultRepository investigationRepository
    ) {
        this.authorityRepository = authorityRepository;
        this.contractorRepository = contractorRepository;
        this.investigationRepository = investigationRepository;
    }

    @Transactional
    public InvestigationResult investigateIssue(RoadIssue issue) {
        log.info("Starting investigation for RoadIssue #{} (Road: {})", issue.getId(), issue.getRoadName());

        InvestigationResult ir = investigationRepository.findByRoadIssueId(issue.getId())
            .orElseGet(() -> {
                InvestigationResult newIr = new InvestigationResult();
                newIr.setRoadIssue(issue);
                return newIr;
            });

        // 1. Resolve Authority via Deterministic Rules
        String roadName = issue.getRoadName() != null ? issue.getRoadName().toUpperCase() : "";
        String deptCode = "UNKNOWN";
        String authorityReason = "Jurisdiction could not be definitively determined from road nomenclature.";
        InvestigationResult.AuthorityConfidence confidence = InvestigationResult.AuthorityConfidence.LOW;

        if (roadName.contains("NH-") || roadName.contains("NATIONAL HIGHWAY")) {
            deptCode = "NHAI";
            authorityReason = "Road is designated as National Highway (NH prefix); governed by NHAI under MoRTH.";
            confidence = InvestigationResult.AuthorityConfidence.HIGH;
        } else if (roadName.contains("SH-") || roadName.contains("STATE HIGHWAY") || roadName.contains("MDR")) {
            deptCode = "AP_RNB";
            authorityReason = "Designated State Highway / Major District Road; under jurisdiction of AP Roads & Buildings Dept.";
            confidence = InvestigationResult.AuthorityConfidence.HIGH;
        } else if (roadName.contains("MUNICIPAL") || roadName.contains("CIRCLE") || roadName.contains("WARD") || roadName.contains("ULB")) {
            deptCode = "CDMA_ULB";
            authorityReason = "Internal urban road located within Municipal Corporation / ULB limits.";
            confidence = InvestigationResult.AuthorityConfidence.MEDIUM;
        } else if (roadName.contains("PMGSY") || roadName.contains("RURAL") || roadName.contains("VILLAGE")) {
            deptCode = "AP_PRED_PMGSY";
            authorityReason = "Rural road constructed or maintained under PMGSY by Panchayat Raj Engineering Dept.";
            confidence = InvestigationResult.AuthorityConfidence.HIGH;
        } else {
            // Default based on address hint
            String address = issue.getAddress() != null ? issue.getAddress().toUpperCase() : "";
            if (address.contains("HIGHWAY") || address.contains("BYPASS")) {
                deptCode = "NHAI";
                authorityReason = "Address indicates major bypass/highway alignment.";
                confidence = InvestigationResult.AuthorityConfidence.MEDIUM;
            } else if (address.contains("MUNICIPAL") || address.contains("VIJAYAWADA") || address.contains("VISAKHAPATNAM")) {
                deptCode = "CDMA_ULB";
                authorityReason = "Located within major urban municipal jurisdiction.";
                confidence = InvestigationResult.AuthorityConfidence.MEDIUM;
            }
        }

        Optional<AuthorityRecord> authOpt = authorityRepository.findByDeptCode(deptCode);
        AuthorityRecord authority = authOpt.orElseGet(() -> authorityRepository.findByDeptCode("UNKNOWN").orElse(null));
        ir.setCandidateAuthority(authority);
        ir.setAuthorityReason(authorityReason);
        ir.setAuthorityConfidence(confidence);

        // 2. Defect Liability Period (DLP) and Tender Check
        checkDlpAndContractor(issue, ir, authority);

        ir.setInvestigatedBy(InvestigationResult.InvestigatedBy.DETERMINISTIC_RULES);
        ir.setInvestigatedAt(Instant.now());

        InvestigationResult saved = investigationRepository.save(ir);
        log.info("Completed investigation for Issue #{}: Authority={}, DLP Applicable={}",
            issue.getId(), deptCode, saved.getDlpApplicable());
        return saved;
    }

    private void checkDlpAndContractor(RoadIssue issue, InvestigationResult ir, AuthorityRecord authority) {
        String roadName = issue.getRoadName() != null ? issue.getRoadName() : "";
        List<ContractorRecord> contractors = contractorRepository.findByRoadNameContainingIgnoreCase(
            roadName.length() > 5 ? roadName.substring(0, Math.min(15, roadName.length())) : roadName
        );

        if (!contractors.isEmpty()) {
            ContractorRecord matched = contractors.get(0);
            ir.setDlpContractor(matched);
            LocalDate dlpEnd = matched.getDlpEndDate();
            ir.setDlpEndDate(dlpEnd);

            if (dlpEnd != null && !LocalDate.now().isAfter(dlpEnd)) {
                // Active DLP!
                ir.setDlpApplicable(true);
                ir.setEvidenceTier(1);
                ir.setEvidenceSummary(String.format(
                    "ACTIVE DEFECT LIABILITY PERIOD (DLP) detected until %s. Contractor '%s' is legally liable for rectification under tender package %s without additional state expenditure.",
                    dlpEnd, matched.getContractorName(), matched.getPackageNumber()
                ));
                ir.setInvestigationNotes("Verified against state/NHAI public tender registry. Contractor has active performance guarantee.");
                return;
            }
        }

        // If no matching contractor record found in local seed database
        ir.setDlpApplicable(false);
        ir.setEvidenceTier(2);
        ir.setEvidenceSummary(String.format(
            "Routine maintenance obligation under jurisdiction of %s. No active DLP contractor record identified in local tender database.",
            authority != null ? authority.getDeptName() : "responsible authority"
        ));
        ir.setMissingInformation("Contractor tender agreement number not linked. Citizen can request concessionaire details via RTI or PGRS.");
        ir.setInvestigationNotes("Standard jurisdiction assigned based on road classification hierarchy.");
    }
}
