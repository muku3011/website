package in.hutta.smdp.controller;

import in.hutta.smdp.model.Profile;
import in.hutta.smdp.repository.ProfileRepository;
import lombok.Data;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/gsma/rsp/v2/admin")
public class AdminController {
    private static final Logger log = LoggerFactory.getLogger(AdminController.class);

    @Autowired
    private ProfileRepository profileRepository;

    @Data
    public static class ImportProfileRequest {
        private String iccid;
        private String profilePayload; // Base64 DER bytes of the profile
    }

    @PostMapping("/importProfile")
    public ResponseEntity<?> importProfile(@RequestBody ImportProfileRequest request) {
        log.info("Admin importProfile: ICCID={}", request.getIccid());
        
        if (request.getIccid() == null || request.getIccid().trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Error: ICCID is required");
        }
        if (request.getProfilePayload() == null || request.getProfilePayload().trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Error: Profile payload (Base64) is required");
        }

        Profile profile = new Profile();
        profile.setIccid(request.getIccid());
        profile.setState("AVAILABLE");
        profile.setProfilePayload(request.getProfilePayload());
        
        profileRepository.save(profile);
        log.info("Profile imported successfully: ICCID={}", request.getIccid());
        
        return ResponseEntity.ok("Profile imported successfully");
    }
}
