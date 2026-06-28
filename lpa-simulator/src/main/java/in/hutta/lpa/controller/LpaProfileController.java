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
        if (!localProfileRepository.existsById(iccid)) {
            return ResponseEntity.notFound().build();
        }

        localProfileRepository.deleteById(iccid);
        return ResponseEntity.ok(Map.of("success", true, "message", "Profile uninstalled successfully"));
    }
}
