package in.hutta.smdp.controller;

import in.hutta.smdp.model.Profile;
import in.hutta.smdp.repository.ProfileRepository;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@CrossOrigin
@RestController
@RequestMapping("/gsma/rsp/v2/admin")
public class AdminController {
  private static final Logger log = LoggerFactory.getLogger(AdminController.class);

  @Autowired private ProfileRepository profileRepository;

  @PostMapping(value = "/importProfile")
  public ResponseEntity<?> importProfile(
      @RequestParam("file") MultipartFile file,
      @RequestParam(value = "iccid", required = false) String iccid) {

    if (file == null || file.isEmpty()) {
      return ResponseEntity.badRequest().body("Error: Uploaded file is empty or missing");
    }

    log.info(
        "Admin importProfile: name={}, size={}, iccid={}",
        file.getOriginalFilename(),
        file.getSize(),
        iccid);

    try {
      byte[] contentBytes = file.getBytes();
      byte[] profileBytes = contentBytes;

      // Try base64 decoding. If the decoded bytes yield a valid ICCID, we use them.
      try {
        String text = new String(contentBytes, StandardCharsets.UTF_8).replaceAll("\\s", "");
        byte[] decoded = Base64.getDecoder().decode(text);
        if (decoded.length > 0) {
          String extracted = extractIccid(decoded);
          if (extracted != null) {
            profileBytes = decoded;
          }
        }
      } catch (Exception e) {
        // Ignore, keep using raw contentBytes
      }

      return importProfileBytes(profileBytes, iccid, file.getOriginalFilename());
    } catch (IOException e) {
      log.error("Failed to read uploaded file", e);
      return ResponseEntity.internalServerError()
          .body("Error reading uploaded file: " + e.getMessage());
    }
  }

  private ResponseEntity<?> importProfileBytes(
      byte[] profileBytes, String overrideIccid, String filename) {
    String iccid = overrideIccid;
    if (iccid == null || iccid.trim().isEmpty()) {
      iccid = extractIccid(profileBytes);
    }

    if (iccid == null || iccid.trim().isEmpty()) {
      return ResponseEntity.badRequest()
          .body(
              "Error: Could not extract ICCID from the profile. Ensure it is a valid GSMA eSIM profile.");
    }

    String payload = Base64.getEncoder().encodeToString(profileBytes);
    String networkType = detectNetworkType(profileBytes, filename);

    Profile profile = new Profile();
    profile.setIccid(iccid);
    profile.setState("AVAILABLE");
    profile.setProfilePayload(payload);
    profile.setNetworkType(networkType);

    profileRepository.save(profile);
    log.info("Profile imported successfully: ICCID={}, networkType={}", iccid, networkType);

    return ResponseEntity.ok("Profile imported successfully");
  }

  @GetMapping("/profiles")
  public ResponseEntity<List<Profile>> getProfiles(
      @RequestParam(value = "state", required = false) String state) {
    if (state != null && !state.trim().isEmpty()) {
      return ResponseEntity.ok(profileRepository.findAllByState(state));
    }
    return ResponseEntity.ok(profileRepository.findAll());
  }

  @DeleteMapping("/profiles/{iccid}")
  public ResponseEntity<?> deleteProfile(@PathVariable("iccid") String iccid) {
    if (iccid == null || iccid.trim().isEmpty()) {
      return ResponseEntity.badRequest().body("Error: ICCID is required");
    }
    if (!profileRepository.existsById(iccid)) {
      return ResponseEntity.notFound().build();
    }
    profileRepository.deleteById(iccid);
    log.info("Profile deleted successfully: ICCID={}", iccid);
    return ResponseEntity.ok("Profile deleted successfully");
  }

  private String extractIccid(byte[] bytes) {
    // Look for ASN.1 DER tag 0x83 followed by length 0x0A (10) representing ICCID
    // in PE-Header
    int limit = Math.min(bytes.length - 11, 1000);
    for (int i = 0; i < limit; i++) {
      if ((bytes[i] & 0xFF) == 0x83 && (bytes[i + 1] & 0xFF) == 0x0A) {
        byte[] iccidBytes = new byte[10];
        System.arraycopy(bytes, i + 2, iccidBytes, 0, 10);
        return bytesToHex(iccidBytes);
      }
    }
    return null;
  }

  private static String bytesToHex(byte[] bytes) {
    StringBuilder sb = new StringBuilder();
    for (byte b : bytes) {
      sb.append(String.format("%02x", b));
    }
    return sb.toString();
  }

  private String detectNetworkType(byte[] profileBytes, String filename) {
    if (filename != null) {
      String upper = filename.toUpperCase();
      if (upper.contains("5G") || upper.contains("NR") || upper.contains("SA")) {
        return "5G";
      }
    }

    // Binary Scan: Search for EF_UST (File ID 6F38) in profile elements
    try {
      int limit = Math.min(profileBytes.length - 18, 5000);
      for (int i = 0; i < limit; i++) {
        if ((profileBytes[i] & 0xFF) == 0x6F && (profileBytes[i + 1] & 0xFF) == 0x38) {
          int ustLength = profileBytes[i + 2] & 0xFF;
          if (ustLength >= 16) {
            int svcByte = profileBytes[i + 2 + 16] & 0xFF;
            if ((svcByte & 0x18) != 0) {
              return "5G";
            }
          }
        }
      }
    } catch (Exception e) {
      // Ignore and fallback
    }

    return "4G";
  }
}
