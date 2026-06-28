package in.hutta.lpa.controller;

import in.hutta.lpa.model.LocalProfile;
import in.hutta.lpa.repository.LocalProfileRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@RestController
@RequestMapping("/lpa/profiles")
@CrossOrigin
@RequiredArgsConstructor
public class LpaProfileController {

    private final LocalProfileRepository localProfileRepository;

    @GetMapping
    public ResponseEntity<List<LocalProfile>> getAllProfiles() {
        log.info("LPA Simulator: Fetching all installed eSIM profiles");
        return ResponseEntity.ok(localProfileRepository.findAll());
    }

    @PutMapping("/{iccid}/enable")
    public ResponseEntity<LocalProfile> enableProfile(@PathVariable String iccid) {
        log.info("LPA Simulator: Request to enable eSIM profile {}", iccid);
        Optional<LocalProfile> profileOpt = localProfileRepository.findById(iccid);
        if (profileOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        // Deactivate all other profiles (simulating single active SIM constraint on eUICC)
        List<LocalProfile> allProfiles = localProfileRepository.findAll();
        for (LocalProfile p : allProfiles) {
            if (p.getIccid().equals(iccid)) {
                p.setProfileState("ENABLED");
            } else {
                p.setProfileState("DISABLED");
            }
        }
        localProfileRepository.saveAll(allProfiles);

        return ResponseEntity.ok(profileOpt.get());
    }

    @PutMapping("/{iccid}/disable")
    public ResponseEntity<LocalProfile> disableProfile(@PathVariable String iccid) {
        log.info("LPA Simulator: Request to disable eSIM profile {}", iccid);
        Optional<LocalProfile> profileOpt = localProfileRepository.findById(iccid);
        if (profileOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        LocalProfile profile = profileOpt.get();
        profile.setProfileState("DISABLED");
        localProfileRepository.save(profile);

        return ResponseEntity.ok(profile);
    }

    @PutMapping("/{iccid}/nickname")
    public ResponseEntity<LocalProfile> updateNickname(
            @PathVariable String iccid,
            @RequestBody Map<String, String> body) {
        String nickname = body.get("nickname");
        log.info("LPA Simulator: Request to update nickname for {} to '{}'", iccid, nickname);
        
        Optional<LocalProfile> profileOpt = localProfileRepository.findById(iccid);
        if (profileOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        LocalProfile profile = profileOpt.get();
        profile.setProfileNickname(nickname);
        localProfileRepository.save(profile);

        return ResponseEntity.ok(profile);
    }

    @DeleteMapping("/{iccid}")
    public ResponseEntity<Map<String, Object>> deleteProfile(@PathVariable String iccid) {
        log.info("LPA Simulator: Request to uninstall/delete eSIM profile {}", iccid);
        Optional<LocalProfile> profileOpt = localProfileRepository.findById(iccid);
        if (profileOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        LocalProfile profile = profileOpt.get();

        // Notify the SM-DP+ server that the profile has been deleted
        try {
            notifySmdpProfileDeletion(profile);
        } catch (Exception e) {
            log.error("LPA Simulator: Failed to notify SM-DP+ of profile deletion: {}", e.getMessage());
        }

        localProfileRepository.deleteById(iccid);
        return ResponseEntity.ok(Map.of("success", true, "message", "Profile uninstalled successfully"));
    }

    private void notifySmdpProfileDeletion(LocalProfile profile) {
        String smdpAddress = profile.getSmdpAddress();
        if (smdpAddress == null || smdpAddress.trim().isEmpty()) {
            return;
        }

        String protocol = "http";
        if (smdpAddress.contains("hutta.in") || (!smdpAddress.contains("localhost") && !smdpAddress.contains("127.0.0.1"))) {
            protocol = "https";
        }
        String url = protocol + "://" + smdpAddress + "/gsma/rsp/v2/es9plus/handleNotification";
        log.info("LPA Simulator: Sending delete notification to SM-DP+ at {}", url);

        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
        headers.set("User-Agent", "gsma-rsp-lpa/3.0.0");

        java.util.Map<String, Object> pendingNotification = java.util.Map.of(
            "profileManagementOperation", "delete",
            "iccid", profile.getIccid(),
            "notificationAddress", smdpAddress
        );
        java.util.Map<String, Object> requestBody = java.util.Map.of(
            "pendingNotification", pendingNotification
        );

        org.springframework.http.HttpEntity<java.util.Map<String, Object>> entity = 
            new org.springframework.http.HttpEntity<>(requestBody, headers);

        org.springframework.web.client.RestTemplate restTemplate = new org.springframework.web.client.RestTemplate();
        restTemplate.postForEntity(url, entity, Void.class);
        log.info("LPA Simulator: Successfully completed deletion sync to SM-DP+");
    }
}
