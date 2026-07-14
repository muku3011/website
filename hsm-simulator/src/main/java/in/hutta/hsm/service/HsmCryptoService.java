package in.hutta.hsm.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import in.hutta.hsm.model.HsmAuditLog;
import in.hutta.hsm.model.HsmObject;
import in.hutta.hsm.repository.HsmAuditLogRepository;
import in.hutta.hsm.repository.HsmObjectRepository;
import jakarta.annotation.PostConstruct;
import java.math.BigInteger;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.SecureRandom;
import java.security.Security;
import java.security.Signature;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.bouncycastle.asn1.x500.X500Name;
import org.bouncycastle.cert.X509CertificateHolder;
import org.bouncycastle.cert.jcajce.JcaX509CertificateConverter;
import org.bouncycastle.cert.jcajce.JcaX509v3CertificateBuilder;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.operator.ContentSigner;
import org.bouncycastle.operator.jcajce.JcaContentSignerBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class HsmCryptoService {
  private static final Logger log = LoggerFactory.getLogger(HsmCryptoService.class);
  private final HsmObjectRepository objectRepository;
  private final HsmAuditLogRepository auditLogRepository;
  private final ObjectMapper objectMapper = new ObjectMapper();

  @PostConstruct
  public void init() {
    if (Security.getProvider("BC") == null) {
      Security.addProvider(new BouncyCastleProvider());
    }
    bootstrapSecrets();
  }

  private void bootstrapSecrets() {
    try {
      bootstrapEnvSecret(1, "smdp-db-pass", "SMDP_DB_PASSWORD");
      bootstrapEnvSecret(1, "lpa-db-pass", "LPA_DB_PASSWORD");
      bootstrapEnvSecret(1, "blog-db-pass", "BLOG_DB_PASSWORD");
      bootstrapEnvSecret(1, "monitor-db-pass", "MONITOR_DB_PASSWORD");
      bootstrapEnvSecret(1, "keycloak-db-pass", "KC_DB_PASSWORD");

      // Also bootstrap default AES db key and EC signing key if not present
      if (!objectRepository.existsBySlotIdAndAlias(1, "smdp-db-key")) {
        Map<String, Object> attrs = new HashMap<>();
        attrs.put("CKA_SENSITIVE", true);
        attrs.put("CKA_EXTRACTABLE", false);
        attrs.put("CKA_ENCRYPT", true);
        attrs.put("CKA_DECRYPT", true);
        generateKey(1, "smdp-db-key", "AES", 256, attrs);
        log.info("[+] Seeded default smdp-db-key inside HSM Slot 1");
      }
      if (!objectRepository.existsBySlotIdAndAlias(1, "smdp-key")) {
        Map<String, Object> attrs = new HashMap<>();
        attrs.put("CKA_SENSITIVE", true);
        attrs.put("CKA_EXTRACTABLE", false);
        attrs.put("CKA_SIGN", true);
        generateKey(1, "smdp-key", "EC", 256, attrs);
        log.info("[+] Seeded default smdp-key inside HSM Slot 1");
      }
    } catch (Exception e) {
      log.error("Failed to bootstrap HSM default secrets", e);
    }
  }

  private void bootstrapEnvSecret(Integer slotId, String alias, String envVarName) {
    String val = System.getenv(envVarName);
    if (val != null
        && !val.trim().isEmpty()
        && !objectRepository.existsBySlotIdAndAlias(slotId, alias)) {
      importSecret(slotId, alias, val.trim(), "GENERIC_SECRET");
      log.info(
          "[+] Imported secret {} from environment variable {} into Slot {}",
          alias,
          envVarName,
          slotId);
    }
  }

  public HsmCryptoService(
      HsmObjectRepository objectRepository, HsmAuditLogRepository auditLogRepository) {
    this.objectRepository = objectRepository;
    this.auditLogRepository = auditLogRepository;
  }

  public void logAudit(String operation, String keyAlias, String status, String details) {
    logAudit(1, operation, keyAlias, status, details);
  }

  public void logAudit(
      Integer slotId, String operation, String keyAlias, String status, String details) {
    HsmAuditLog auditLog = new HsmAuditLog();
    auditLog.setSlotId(slotId);
    auditLog.setOperation(operation);
    auditLog.setKeyAlias(keyAlias);
    auditLog.setStatus(status);
    auditLog.setDetails(details);
    auditLogRepository.save(auditLog);
  }

  private Map<String, Object> parseAttributes(String attributesJson) {
    try {
      return objectMapper.readValue(attributesJson, Map.class);
    } catch (Exception e) {
      return new HashMap<>();
    }
  }

  public void generateKey(
      Integer slotId,
      String alias,
      String algorithm,
      int keySize,
      Map<String, Object> reqAttributes) {
    try {
      if (objectRepository.existsBySlotIdAndAlias(slotId, alias)) {
        throw new IllegalArgumentException(
            "Object already exists with alias: " + alias + " in slot " + slotId);
      }

      Map<String, Object> attributes = new HashMap<>();
      attributes.put("CKA_LABEL", alias);
      attributes.put("CKA_KEY_TYPE", "AES".equalsIgnoreCase(algorithm) ? "CKK_AES" : "CKK_EC");
      attributes.put("CKA_TOKEN", true);
      attributes.put("CKA_SENSITIVE", reqAttributes.getOrDefault("CKA_SENSITIVE", true));
      attributes.put("CKA_EXTRACTABLE", reqAttributes.getOrDefault("CKA_EXTRACTABLE", false));
      attributes.put("CKA_ENCRYPT", reqAttributes.getOrDefault("CKA_ENCRYPT", true));
      attributes.put("CKA_DECRYPT", reqAttributes.getOrDefault("CKA_DECRYPT", true));
      attributes.put("CKA_SIGN", reqAttributes.getOrDefault("CKA_SIGN", true));
      attributes.put("CKA_VERIFY", reqAttributes.getOrDefault("CKA_VERIFY", true));

      String jsonAttributes = objectMapper.writeValueAsString(attributes);

      if ("AES".equalsIgnoreCase(algorithm)) {
        KeyGenerator kg = KeyGenerator.getInstance("AES");
        kg.init(keySize);
        SecretKey secretKey = kg.generateKey();

        HsmObject obj = new HsmObject();
        obj.setSlotId(slotId);
        obj.setAlias(alias);
        obj.setObjectType("SECRET_KEY");
        obj.setAlgorithm("AES");
        obj.setKeySize(keySize);
        obj.setKeyMaterial(secretKey.getEncoded());
        obj.setAttributes(jsonAttributes);
        objectRepository.save(obj);
      } else if ("EC".equalsIgnoreCase(algorithm)) {
        KeyPairGenerator kpg = KeyPairGenerator.getInstance("EC", "BC");
        kpg.initialize(new ECGenParameterSpec("secp256r1"));
        KeyPair kp = kpg.generateKeyPair();

        String certBase64 = generateSelfSignedCertificate(kp, alias);

        HsmObject privateObj = new HsmObject();
        privateObj.setSlotId(slotId);
        privateObj.setAlias(alias);
        privateObj.setObjectType("PRIVATE_KEY");
        privateObj.setAlgorithm("EC");
        privateObj.setKeySize(256);
        privateObj.setKeyMaterial(kp.getPrivate().getEncoded());
        privateObj.setCertificateData(Base64.getDecoder().decode(certBase64));
        privateObj.setAttributes(jsonAttributes);
        objectRepository.save(privateObj);
      } else if ("GENERIC_SECRET".equalsIgnoreCase(algorithm)) {
        HsmObject obj = new HsmObject();
        obj.setSlotId(slotId);
        obj.setAlias(alias);
        obj.setObjectType("SECRET_KEY");
        obj.setAlgorithm("GENERIC_SECRET");
        obj.setKeySize(keySize);
        byte[] secret = new byte[keySize];
        new SecureRandom().nextBytes(secret);
        obj.setKeyMaterial(secret);
        obj.setAttributes(jsonAttributes);
        objectRepository.save(obj);
      } else {
        throw new IllegalArgumentException("Unsupported algorithm: " + algorithm);
      }

      logAudit(slotId, "GENERATE_KEY", alias, "SUCCESS", "Generated " + algorithm + " key");
    } catch (Exception e) {
      logAudit(slotId, "GENERATE_KEY", alias, "FAILED", e.getMessage());
      throw new RuntimeException(e);
    }
  }

  public byte[] encrypt(Integer slotId, String alias, byte[] iv, int tagLength, byte[] plaintext) {
    try {
      HsmObject obj =
          objectRepository
              .findBySlotIdAndAlias(slotId, alias)
              .orElseThrow(
                  () ->
                      new IllegalArgumentException(
                          "Key not found: " + alias + " in slot " + slotId));

      Map<String, Object> attrs = parseAttributes(obj.getAttributes());
      if (!Boolean.TRUE.equals(attrs.get("CKA_ENCRYPT"))) {
        throw new SecurityException(
            "CKR_KEY_FUNCTION_NOT_ALLOWED: Key is not configured for encryption");
      }

      SecretKey secretKey = new SecretKeySpec(obj.getKeyMaterial(), "AES");
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      GCMParameterSpec spec = new GCMParameterSpec(tagLength, iv);
      cipher.init(Cipher.ENCRYPT_MODE, secretKey, spec);

      byte[] ciphertext = cipher.doFinal(plaintext);
      logAudit(
          slotId,
          "ENCRYPT",
          alias,
          "SUCCESS",
          "Encrypted payload of size " + plaintext.length + " bytes");
      return ciphertext;
    } catch (Exception e) {
      logAudit(slotId, "ENCRYPT", alias, "FAILED", e.getMessage());
      throw new RuntimeException(e);
    }
  }

  public byte[] decrypt(Integer slotId, String alias, byte[] iv, int tagLength, byte[] ciphertext) {
    try {
      HsmObject obj =
          objectRepository
              .findBySlotIdAndAlias(slotId, alias)
              .orElseThrow(
                  () ->
                      new IllegalArgumentException(
                          "Key not found: " + alias + " in slot " + slotId));

      Map<String, Object> attrs = parseAttributes(obj.getAttributes());
      if (!Boolean.TRUE.equals(attrs.get("CKA_DECRYPT"))) {
        throw new SecurityException(
            "CKR_KEY_FUNCTION_NOT_ALLOWED: Key is not configured for decryption");
      }

      SecretKey secretKey = new SecretKeySpec(obj.getKeyMaterial(), "AES");
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      GCMParameterSpec spec = new GCMParameterSpec(tagLength, iv);
      cipher.init(Cipher.DECRYPT_MODE, secretKey, spec);

      byte[] plaintext = cipher.doFinal(ciphertext);
      logAudit(
          slotId,
          "DECRYPT",
          alias,
          "SUCCESS",
          "Decrypted payload of size " + ciphertext.length + " bytes");
      return plaintext;
    } catch (Exception e) {
      logAudit(slotId, "DECRYPT", alias, "FAILED", e.getMessage());
      throw new RuntimeException(e);
    }
  }

  public byte[] sign(Integer slotId, String alias, byte[] data) {
    try {
      HsmObject obj =
          objectRepository
              .findBySlotIdAndAlias(slotId, alias)
              .orElseThrow(
                  () ->
                      new IllegalArgumentException(
                          "Key not found: " + alias + " in slot " + slotId));

      Map<String, Object> attrs = parseAttributes(obj.getAttributes());
      if (!Boolean.TRUE.equals(attrs.get("CKA_SIGN"))) {
        throw new SecurityException(
            "CKR_KEY_FUNCTION_NOT_ALLOWED: Key is not configured for signing");
      }

      PKCS8EncodedKeySpec spec = new PKCS8EncodedKeySpec(obj.getKeyMaterial());
      KeyFactory kf = KeyFactory.getInstance("EC", "BC");
      PrivateKey privateKey = kf.generatePrivate(spec);

      Signature sig = Signature.getInstance("SHA256withECDSA", "BC");
      sig.initSign(privateKey);
      sig.update(data);

      byte[] signatureBytes = sig.sign();
      logAudit(
          slotId, "SIGN", alias, "SUCCESS", "Signed payload of size " + data.length + " bytes");
      return signatureBytes;
    } catch (Exception e) {
      logAudit(slotId, "SIGN", alias, "FAILED", e.getMessage());
      throw new RuntimeException(e);
    }
  }

  public byte[] performECDH(Integer slotId, String alias, byte[] peerPublicKeyBytes) {
    try {
      HsmObject obj =
          objectRepository
              .findBySlotIdAndAlias(slotId, alias)
              .orElseThrow(
                  () ->
                      new IllegalArgumentException(
                          "Key not found: " + alias + " in slot " + slotId));

      PKCS8EncodedKeySpec spec = new PKCS8EncodedKeySpec(obj.getKeyMaterial());
      KeyFactory kf = KeyFactory.getInstance("EC", "BC");
      PrivateKey privateKey = kf.generatePrivate(spec);

      X509EncodedKeySpec peerSpec = new X509EncodedKeySpec(peerPublicKeyBytes);
      PublicKey peerPublicKey = kf.generatePublic(peerSpec);

      KeyAgreement ka = KeyAgreement.getInstance("ECDH", "BC");
      ka.init(privateKey);
      ka.doPhase(peerPublicKey, true);

      byte[] sharedSecret = ka.generateSecret();
      logAudit(slotId, "ECDH", alias, "SUCCESS", "ECDH shared secret derived successfully");
      return sharedSecret;
    } catch (Exception e) {
      logAudit(slotId, "ECDH", alias, "FAILED", e.getMessage());
      throw new RuntimeException(e);
    }
  }

  private String generateSelfSignedCertificate(KeyPair keyPair, String alias) throws Exception {
    long now = System.currentTimeMillis();
    Date startDate = new Date(now);
    X500Name dnName = new X500Name("CN=" + alias + ", O=Hutta, C=IN");
    BigInteger certSerialNumber = new BigInteger(Long.toString(now));
    Date endDate = new Date(now + 365L * 24L * 60L * 60L * 1000L);

    JcaX509v3CertificateBuilder certBuilder =
        new JcaX509v3CertificateBuilder(
            dnName, certSerialNumber, startDate, endDate, dnName, keyPair.getPublic());

    ContentSigner contentSigner =
        new JcaContentSignerBuilder("SHA256withECDSA")
            .setProvider("BC")
            .build(keyPair.getPrivate());

    X509CertificateHolder certHolder = certBuilder.build(contentSigner);
    java.security.cert.X509Certificate cert =
        new JcaX509CertificateConverter().setProvider("BC").getCertificate(certHolder);

    return Base64.getEncoder().encodeToString(cert.getEncoded());
  }

  public void importSecret(Integer slotId, String alias, String secretVal, String algorithm) {
    try {
      if (objectRepository.existsBySlotIdAndAlias(slotId, alias)) {
        HsmObject obj = objectRepository.findBySlotIdAndAlias(slotId, alias).get();
        obj.setKeyMaterial(secretVal.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        objectRepository.save(obj);
        logAudit(slotId, "IMPORT_SECRET", alias, "SUCCESS", "Replaced existing secret alias");
        return;
      }

      Map<String, Object> attributes = new HashMap<>();
      attributes.put("CKA_LABEL", alias);
      attributes.put("CKA_KEY_TYPE", "CKK_GENERIC_SECRET");
      attributes.put("CKA_TOKEN", true);
      attributes.put("CKA_SENSITIVE", false);
      attributes.put("CKA_EXTRACTABLE", true);

      String jsonAttributes = objectMapper.writeValueAsString(attributes);

      HsmObject obj = new HsmObject();
      obj.setSlotId(slotId);
      obj.setAlias(alias);
      obj.setObjectType("SECRET_KEY");
      obj.setAlgorithm(algorithm);
      obj.setKeySize(secretVal.length() * 8);
      obj.setKeyMaterial(secretVal.getBytes(java.nio.charset.StandardCharsets.UTF_8));
      obj.setAttributes(jsonAttributes);
      objectRepository.save(obj);

      logAudit(slotId, "IMPORT_SECRET", alias, "SUCCESS", "Imported generic secret");
    } catch (Exception e) {
      logAudit(slotId, "IMPORT_SECRET", alias, "FAILED", e.getMessage());
      throw new RuntimeException(e);
    }
  }
}
