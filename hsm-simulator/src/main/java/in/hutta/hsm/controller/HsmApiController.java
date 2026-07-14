package in.hutta.hsm.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import in.hutta.hsm.model.HsmAuditLog;
import in.hutta.hsm.model.HsmConfig;
import in.hutta.hsm.model.HsmObject;
import in.hutta.hsm.model.HsmSlot;
import in.hutta.hsm.repository.HsmAuditLogRepository;
import in.hutta.hsm.repository.HsmConfigRepository;
import in.hutta.hsm.repository.HsmObjectRepository;
import in.hutta.hsm.repository.HsmSlotRepository;
import in.hutta.hsm.service.HsmCryptoService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/hsm")
public class HsmApiController {
  private final HsmCryptoService cryptoService;
  private final HsmObjectRepository objectRepository;
  private final HsmAuditLogRepository auditLogRepository;
  private final HsmSlotRepository slotRepository;
  private final HsmConfigRepository configRepository;

  public HsmApiController(
      HsmCryptoService cryptoService,
      HsmObjectRepository objectRepository,
      HsmAuditLogRepository auditLogRepository,
      HsmSlotRepository slotRepository,
      HsmConfigRepository configRepository) {
    this.cryptoService = cryptoService;
    this.objectRepository = objectRepository;
    this.auditLogRepository = auditLogRepository;
    this.slotRepository = slotRepository;
    this.configRepository = configRepository;
  }

  private String getAuthenticatedUser(HttpServletRequest request) {
    // Check for custom header or Apache-set OIDC header first
    String username = request.getHeader("OIDC_CLAIM_preferred_username");
    if (username != null && !username.trim().isEmpty()) {
      return username;
    }

    String forwardUser = request.getHeader("X-Forwarded-User");
    if (forwardUser != null && !forwardUser.trim().isEmpty()) {
      return forwardUser;
    }

    // Fallback: search for hutta_user cookie
    if (request.getCookies() != null) {
      for (Cookie cookie : request.getCookies()) {
        if ("hutta_user".equals(cookie.getName())) {
          String val = cookie.getValue();
          if (val != null) {
            if (val.startsWith("\"") && val.endsWith("\"")) {
              val = val.substring(1, val.length() - 1);
            }
            return val;
          }
        }
      }
    }

    // Dev bypass for local development/testing without apache
    String host = request.getHeader("Host");
    if (host != null && (host.contains("localhost") || host.contains("127.0.0.1"))) {
      return "Mukesh Joshi";
    }

    return null;
  }

  private String getAuthenticatedAdminRole(HttpServletRequest request) {
    String adminUserHeader = request.getHeader("X-HSM-ADMIN-USER");
    String adminPinHeader = request.getHeader("X-HSM-ADMIN-PIN");
    if (adminUserHeader == null || adminPinHeader == null) {
      return null;
    }
    if (!"admin".equals(adminUserHeader) && !"so".equals(adminUserHeader)) {
      return null;
    }
    String configKey = "admin".equals(adminUserHeader) ? "admin_pin" : "so_pin";
    HsmConfig config = configRepository.findById(configKey).orElse(null);
    String actualPin =
        config != null
            ? config.getConfigValue()
            : ("admin".equals(adminUserHeader) ? "admin123" : "so123");
    if (actualPin.equals(adminPinHeader)) {
      return adminUserHeader;
    }
    return null;
  }

  private HsmSlot resolveSlotByPin(String pin) {
    if (pin == null || pin.isEmpty()) {
      return null;
    }
    return slotRepository.findBySlotPin(pin).orElse(null);
  }

  // --------------------------------------------------------------------------
  // ADMINISTRATIVE & GLOBAL CONFIG APIs
  // --------------------------------------------------------------------------

  @PostMapping("/admin/login")
  public ResponseEntity<?> adminLogin(@RequestBody Map<String, String> request) {
    String username = request.get("username");
    String pin = request.get("pin");

    if (!"admin".equals(username) && !"so".equals(username)) {
      return ResponseEntity.status(401).body(Map.of("error", "Invalid Admin/SO username"));
    }

    String configKey = "admin".equals(username) ? "admin_pin" : "so_pin";
    HsmConfig config = configRepository.findById(configKey).orElse(null);
    String actualPin =
        config != null
            ? config.getConfigValue()
            : ("admin".equals(username) ? "admin123" : "so123");

    if (actualPin.equals(pin)) {
      cryptoService.logAudit(1, "ADMIN_LOGIN", null, "SUCCESS", "Logged in as " + username);
      return ResponseEntity.ok(Map.of("status", "SUCCESS", "role", username));
    } else {
      cryptoService.logAudit(
          1, "ADMIN_LOGIN", null, "FAILED", "Incorrect Admin/SO PIN for " + username);
      return ResponseEntity.status(401).body(Map.of("error", "Invalid Admin/SO PIN"));
    }
  }

  @PostMapping("/admin/change-pin")
  public ResponseEntity<?> changeAdminPin(@RequestBody Map<String, String> request) {
    String username = request.get("username");
    String oldPin = request.get("oldPin");
    String newPin = request.get("newPin");

    if (!"admin".equals(username) && !"so".equals(username)) {
      return ResponseEntity.badRequest().body(Map.of("error", "Invalid username"));
    }
    if (newPin == null || newPin.trim().isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "New PIN cannot be empty"));
    }

    String configKey = "admin".equals(username) ? "admin_pin" : "so_pin";
    HsmConfig config = configRepository.findById(configKey).orElse(null);
    if (config == null) {
      config = new HsmConfig();
      config.setConfigKey(configKey);
    }
    String actualPin = config.getConfigValue();
    if (actualPin == null) {
      actualPin = "admin".equals(username) ? "admin123" : "so123";
    }

    if (!actualPin.equals(oldPin)) {
      return ResponseEntity.status(401).body(Map.of("error", "Incorrect old PIN"));
    }

    config.setConfigValue(newPin);
    configRepository.save(config);
    cryptoService.logAudit(1, "CHANGE_ADMIN_PIN", null, "SUCCESS", "Changed PIN for " + username);
    return ResponseEntity.ok(Map.of("status", "SUCCESS"));
  }

  @GetMapping("/admin/audit-logs")
  public ResponseEntity<?> getAdminAuditLogs(HttpServletRequest httpRequest) {
    String adminRole = getAuthenticatedAdminRole(httpRequest);
    if (!"admin".equals(adminRole)) {
      return ResponseEntity.status(403)
          .body(Map.of("error", "Access denied: Only Appliance Admin can view global audit logs"));
    }
    List<HsmAuditLog> logs = auditLogRepository.findTop100ByOrderByTimestampDesc();
    return ResponseEntity.ok(logs);
  }

  // --------------------------------------------------------------------------
  // SLOT MANAGEMENT APIs
  // --------------------------------------------------------------------------

  @GetMapping("/slots")
  public ResponseEntity<?> getSlots() {
    List<HsmSlot> slots = slotRepository.findAll();
    List<Map<String, Object>> result =
        slots.stream()
            .map(
                s -> {
                  Map<String, Object> map = new HashMap<>();
                  map.put("id", s.getId());
                  map.put("label", s.getLabel());
                  map.put("description", s.getDescription());
                  map.put("status", s.getStatus());
                  return map;
                })
            .toList();
    return ResponseEntity.ok(result);
  }

  @PostMapping("/slots")
  public ResponseEntity<?> createSlot(
      @RequestBody Map<String, String> request, HttpServletRequest httpRequest) {
    String webUser = getAuthenticatedUser(httpRequest);
    if (webUser == null) {
      return ResponseEntity.status(401)
          .body(Map.of("error", "Web user session invalid or not logged in"));
    }
    String adminRole = getAuthenticatedAdminRole(httpRequest);
    if (!"admin".equals(adminRole)) {
      return ResponseEntity.status(403)
          .body(Map.of("error", "Access denied: Only Appliance Admin can create slots"));
    }

    String label = request.get("label");
    String description = request.get("description");
    String pin = request.get("slotPin");

    if (label == null || label.trim().isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "Slot label is required"));
    }
    if (pin == null || pin.trim().length() < 4) {
      return ResponseEntity.badRequest()
          .body(Map.of("error", "Slot PIN must be at least 4 digits"));
    }

    if (slotRepository.existsBySlotPin(pin)) {
      return ResponseEntity.badRequest()
          .body(Map.of("error", "A slot with this PIN already exists"));
    }

    HsmSlot slot = new HsmSlot();
    slot.setLabel(label);
    slot.setDescription(description);
    slot.setSlotPin(pin);
    slot.setStatus("INITIALIZED");
    HsmSlot saved = slotRepository.save(slot);

    cryptoService.logAudit(
        saved.getId(), "CREATE_SLOT", null, "SUCCESS", "Slot created by web user: " + webUser);
    return ResponseEntity.ok(saved);
  }

  @DeleteMapping("/slots/{id}")
  public ResponseEntity<?> deleteSlot(@PathVariable Integer id, HttpServletRequest httpRequest) {
    String webUser = getAuthenticatedUser(httpRequest);
    if (webUser == null) {
      return ResponseEntity.status(401)
          .body(Map.of("error", "Web user session invalid or not logged in"));
    }
    String adminRole = getAuthenticatedAdminRole(httpRequest);
    if (!"admin".equals(adminRole)) {
      return ResponseEntity.status(403)
          .body(Map.of("error", "Access denied: Only Appliance Admin can delete slots"));
    }
    if (id == 1) {
      return ResponseEntity.badRequest()
          .body(Map.of("error", "Cannot delete the default slot (ID 1)"));
    }

    HsmSlot slot = slotRepository.findById(id).orElse(null);
    if (slot == null) {
      return ResponseEntity.status(404).body(Map.of("error", "Slot not found"));
    }

    // Cascade delete keys
    List<HsmObject> keys = objectRepository.findBySlotId(id);
    objectRepository.deleteAll(keys);

    // Delete slot
    slotRepository.delete(slot);

    cryptoService.logAudit(
        1,
        "DELETE_SLOT",
        null,
        "SUCCESS",
        "Deleted slot: " + slot.getLabel() + " (ID: " + id + ") by web user: " + webUser);
    return ResponseEntity.ok(Map.of("status", "SUCCESS"));
  }

  @PostMapping("/slots/{id}/change-pin")
  public ResponseEntity<?> changeSlotPin(
      @PathVariable Integer id, @RequestBody Map<String, String> request) {
    String oldPin = request.get("oldPin");
    String newPin = request.get("newPin");

    HsmSlot slot = slotRepository.findById(id).orElse(null);
    if (slot == null) {
      return ResponseEntity.status(404).body(Map.of("error", "Slot not found"));
    }
    if (!slot.getSlotPin().equals(oldPin)) {
      return ResponseEntity.status(401).body(Map.of("error", "Incorrect old PIN"));
    }
    if (newPin == null || newPin.trim().length() < 4) {
      return ResponseEntity.badRequest().body(Map.of("error", "New PIN must be at least 4 digits"));
    }

    if (!newPin.equals(oldPin) && slotRepository.existsBySlotPin(newPin)) {
      return ResponseEntity.badRequest()
          .body(Map.of("error", "A slot with this PIN already exists"));
    }

    slot.setSlotPin(newPin);
    slotRepository.save(slot);
    cryptoService.logAudit(id, "CHANGE_SLOT_PIN", null, "SUCCESS", "Changed PIN for slot " + id);
    return ResponseEntity.ok(Map.of("status", "SUCCESS"));
  }

  @PostMapping("/slots/{id}/initialize")
  public ResponseEntity<?> initializeSlot(
      @PathVariable Integer id,
      @RequestBody Map<String, String> request,
      HttpServletRequest httpRequest) {
    String adminRole = getAuthenticatedAdminRole(httpRequest);
    if (!"so".equals(adminRole)) {
      return ResponseEntity.status(403)
          .body(Map.of("error", "Access denied: Only Security Officer (SO) can initialize slots"));
    }

    HsmSlot slot = slotRepository.findById(id).orElse(null);
    if (slot == null) {
      return ResponseEntity.status(404).body(Map.of("error", "Slot not found"));
    }

    String pin = request.get("slotPin");
    if (pin == null || pin.trim().length() < 4) {
      return ResponseEntity.badRequest()
          .body(Map.of("error", "Slot PIN must be at least 4 digits"));
    }

    // Cascade delete keys inside this slot
    List<HsmObject> keys = objectRepository.findBySlotId(id);
    objectRepository.deleteAll(keys);

    slot.setSlotPin(pin);
    slot.setStatus("INITIALIZED");
    slotRepository.save(slot);

    cryptoService.logAudit(
        id, "FORMAT_SLOT", null, "SUCCESS", "Slot formatted & initialized by SO");
    return ResponseEntity.ok(Map.of("status", "SUCCESS"));
  }

  @PostMapping("/slots/{id}/reset-user-pin")
  public ResponseEntity<?> resetUserPin(
      @PathVariable Integer id,
      @RequestBody Map<String, String> request,
      HttpServletRequest httpRequest) {
    String adminRole = getAuthenticatedAdminRole(httpRequest);
    if (!"so".equals(adminRole)) {
      return ResponseEntity.status(403)
          .body(Map.of("error", "Access denied: Only Security Officer (SO) can reset user PINs"));
    }

    HsmSlot slot = slotRepository.findById(id).orElse(null);
    if (slot == null) {
      return ResponseEntity.status(404).body(Map.of("error", "Slot not found"));
    }

    String newPin = request.get("newPin");
    if (newPin == null || newPin.trim().length() < 4) {
      return ResponseEntity.badRequest()
          .body(Map.of("error", "Slot PIN must be at least 4 digits"));
    }

    slot.setSlotPin(newPin);
    slotRepository.save(slot);

    cryptoService.logAudit(id, "RESET_SLOT_PIN", null, "SUCCESS", "User PIN reset by SO");
    return ResponseEntity.ok(Map.of("status", "SUCCESS"));
  }

  // --------------------------------------------------------------------------
  // CRYPTOGRAPHIC KEY / SESSION & OPERATIONS APIs (Slot PIN Authenticated)
  // --------------------------------------------------------------------------

  @PostMapping("/session")
  public ResponseEntity<?> createSession(@RequestBody Map<String, String> request) {
    String pin = request.get("pin");
    HsmSlot slot = resolveSlotByPin(pin);
    if (slot == null) {
      cryptoService.logAudit("CREATE_SESSION", null, "FAILED", "Incorrect PIN provided");
      return ResponseEntity.status(401).body(Map.of("error", "CKR_PIN_INCORRECT"));
    }
    cryptoService.logAudit(
        slot.getId(),
        "CREATE_SESSION",
        null,
        "SUCCESS",
        "Session created successfully for slot: " + slot.getLabel());
    return ResponseEntity.ok(
        Map.of(
            "status",
            "CKR_OK",
            "sessionId",
            "session_" + System.currentTimeMillis(),
            "slotId",
            slot.getId(),
            "slotLabel",
            slot.getLabel()));
  }

  @GetMapping("/keys")
  public ResponseEntity<?> listKeys(
      @RequestHeader(value = "X-HSM-PIN", required = false) String pin) {
    HsmSlot slot = resolveSlotByPin(pin);
    if (slot == null) {
      return ResponseEntity.status(401).body(Map.of("error", "CKR_PIN_INCORRECT"));
    }
    List<HsmObject> objects = objectRepository.findBySlotId(slot.getId());
    return ResponseEntity.ok(objects);
  }

  @GetMapping("/keys/{alias}")
  @SuppressWarnings("unchecked")
  public ResponseEntity<?> getKey(
      @PathVariable String alias,
      @RequestHeader(value = "X-HSM-PIN", required = false) String pin) {
    HsmSlot slot = resolveSlotByPin(pin);
    if (slot == null) {
      return ResponseEntity.status(401).body(Map.of("error", "CKR_PIN_INCORRECT"));
    }
    HsmObject obj = objectRepository.findBySlotIdAndAlias(slot.getId(), alias).orElse(null);
    if (obj == null) {
      return ResponseEntity.status(404).body(Map.of("error", "CKR_OBJECT_HANDLE_INVALID"));
    }

    Map<String, Object> res = new HashMap<>();
    res.put("alias", obj.getAlias());
    res.put("objectType", obj.getObjectType());
    res.put("algorithm", obj.getAlgorithm());
    res.put("keySize", obj.getKeySize());
    res.put(
        "certificateData",
        obj.getCertificateData() != null
            ? Base64.getEncoder().encodeToString(obj.getCertificateData())
            : null);

    ObjectMapper mapper = new ObjectMapper();
    try {
      res.put("attributes", mapper.readValue(obj.getAttributes(), Map.class));
      Map<String, Object> attrs = (Map<String, Object>) res.get("attributes");
      if (Boolean.TRUE.equals(attrs.get("CKA_EXTRACTABLE")) && obj.getKeyMaterial() != null) {
        res.put("keyMaterial", Base64.getEncoder().encodeToString(obj.getKeyMaterial()));
      }
    } catch (Exception e) {
      res.put("attributes", new HashMap<>());
    }

    return ResponseEntity.ok(res);
  }

  @PostMapping("/keys/generate")
  @SuppressWarnings("unchecked")
  public ResponseEntity<?> generateKey(
      @RequestBody Map<String, Object> request,
      @RequestHeader(value = "X-HSM-PIN", required = false) String pin) {
    HsmSlot slot = resolveSlotByPin(pin);
    if (slot == null) {
      return ResponseEntity.status(401).body(Map.of("error", "CKR_PIN_INCORRECT"));
    }
    String alias = (String) request.get("alias");
    String algorithm = (String) request.get("algorithm");
    int keySize = ((Number) request.getOrDefault("keySize", 256)).intValue();
    Map<String, Object> attributes =
        (Map<String, Object>) request.getOrDefault("attributes", new HashMap<>());

    try {
      cryptoService.generateKey(slot.getId(), alias, algorithm, keySize, attributes);
      return ResponseEntity.ok(Map.of("status", "CKR_OK"));
    } catch (Exception e) {
      return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }
  }

  @DeleteMapping("/keys/{alias}")
  public ResponseEntity<?> deleteKey(
      @PathVariable String alias,
      @RequestHeader(value = "X-HSM-PIN", required = false) String pin) {
    HsmSlot slot = resolveSlotByPin(pin);
    if (slot == null) {
      return ResponseEntity.status(401).body(Map.of("error", "CKR_PIN_INCORRECT"));
    }
    HsmObject obj = objectRepository.findBySlotIdAndAlias(slot.getId(), alias).orElse(null);
    if (obj == null) {
      return ResponseEntity.status(404).body(Map.of("error", "CKR_OBJECT_HANDLE_INVALID"));
    }
    objectRepository.delete(obj);
    cryptoService.logAudit(slot.getId(), "DELETE_KEY", alias, "SUCCESS", "Key deleted");
    return ResponseEntity.ok(Map.of("status", "CKR_OK"));
  }

  @PostMapping("/crypto/cipher")
  public ResponseEntity<?> performCipher(
      @RequestBody Map<String, Object> request,
      @RequestHeader(value = "X-HSM-PIN", required = false) String pin) {
    HsmSlot slot = resolveSlotByPin(pin);
    if (slot == null) {
      return ResponseEntity.status(401).body(Map.of("error", "CKR_PIN_INCORRECT"));
    }
    int opmode = ((Number) request.get("opmode")).intValue();
    String alias = (String) request.get("alias");
    byte[] iv =
        request.get("iv") != null ? Base64.getDecoder().decode((String) request.get("iv")) : null;
    int tagLength = ((Number) request.getOrDefault("tagLength", 128)).intValue();
    byte[] data = Base64.getDecoder().decode((String) request.get("data"));

    try {
      byte[] result;
      if (opmode == 1) {
        result = cryptoService.encrypt(slot.getId(), alias, iv, tagLength, data);
      } else {
        result = cryptoService.decrypt(slot.getId(), alias, iv, tagLength, data);
      }
      return ResponseEntity.ok(
          Map.of("status", "CKR_OK", "result", Base64.getEncoder().encodeToString(result)));
    } catch (Exception e) {
      return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }
  }

  @PostMapping("/crypto/sign")
  public ResponseEntity<?> performSign(
      @RequestBody Map<String, Object> request,
      @RequestHeader(value = "X-HSM-PIN", required = false) String pin) {
    HsmSlot slot = resolveSlotByPin(pin);
    if (slot == null) {
      return ResponseEntity.status(401).body(Map.of("error", "CKR_PIN_INCORRECT"));
    }
    String alias = (String) request.get("alias");
    byte[] data = Base64.getDecoder().decode((String) request.get("data"));

    try {
      byte[] signature = cryptoService.sign(slot.getId(), alias, data);
      return ResponseEntity.ok(
          Map.of("status", "CKR_OK", "signature", Base64.getEncoder().encodeToString(signature)));
    } catch (Exception e) {
      return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }
  }

  @PostMapping("/crypto/ecdh")
  public ResponseEntity<?> performECDH(
      @RequestBody Map<String, Object> request,
      @RequestHeader(value = "X-HSM-PIN", required = false) String pin) {
    HsmSlot slot = resolveSlotByPin(pin);
    if (slot == null) {
      return ResponseEntity.status(401).body(Map.of("error", "CKR_PIN_INCORRECT"));
    }
    String alias = (String) request.get("alias");
    byte[] peerPublicKey = Base64.getDecoder().decode((String) request.get("peerPublicKey"));

    try {
      byte[] sharedSecret = cryptoService.performECDH(slot.getId(), alias, peerPublicKey);
      return ResponseEntity.ok(
          Map.of(
              "status",
              "CKR_OK",
              "sharedSecret",
              Base64.getEncoder().encodeToString(sharedSecret)));
    } catch (Exception e) {
      return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }
  }

  @GetMapping("/audit-logs")
  public ResponseEntity<?> getAuditLogs(
      @RequestHeader(value = "X-HSM-PIN", required = false) String pin) {
    HsmSlot slot = resolveSlotByPin(pin);
    if (slot == null) {
      return ResponseEntity.status(401).body(Map.of("error", "CKR_PIN_INCORRECT"));
    }
    List<HsmAuditLog> logs =
        auditLogRepository.findTop100BySlotIdOrderByTimestampDesc(slot.getId());
    return ResponseEntity.ok(logs);
  }

  @GetMapping("/status")
  public ResponseEntity<?> getStatus() {
    Map<String, Object> res = new HashMap<>();
    res.put("status", "ONLINE");
    res.put("model", "Hutta-Network-HSM-Sim-v1");
    res.put("totalSlots", slotRepository.count());
    res.put("activeSessionCount", 1);
    res.put("pinConfigured", true);
    return ResponseEntity.ok(res);
  }
}
