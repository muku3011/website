package in.hutta.smdp.config;

import in.hutta.hsm.provider.HuttaHsmProvider;
import in.hutta.smdp.util.CryptoConverter;
import jakarta.annotation.PostConstruct;
import java.security.Key;
import java.security.KeyStore;
import java.security.Security;
import java.util.Base64;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DatabaseSecurityConfig {

  private static final Logger log = LoggerFactory.getLogger(DatabaseSecurityConfig.class);

  @Value("${smdp.db-encryption-key:}")
  private String base64Key;

  @Value("${smdp.hsm.enabled:false}")
  private boolean hsmEnabled;

  @Value("${smdp.hsm.url:http://localhost:8096}")
  private String hsmUrl;

  @Value("${smdp.hsm.pin:1234}")
  private String hsmPin;

  @PostConstruct
  public void init() {
    if (hsmEnabled) {
      try {
        log.info("[*] HSM is enabled. Initializing database encryption with HSM key: smdp-db-key");
        HuttaHsmProvider provider = new HuttaHsmProvider(hsmUrl, hsmPin);
        Security.addProvider(provider);

        KeyStore ks = KeyStore.getInstance("PKCS11", provider);
        ks.load(null, hsmPin.toCharArray());

        Key hsmKey = ks.getKey("smdp-db-key", null);
        if (hsmKey == null) {
          throw new RuntimeException("smdp-db-key not found in HSM!");
        }

        CryptoConverter.setKey(hsmKey, "HuttaPKCS11");
        log.info("[+] Database security configuration initialized with HSM-backed encryption key.");
      } catch (Exception e) {
        log.error("[-] Failed to initialize database security configuration with HSM key", e);
        throw new RuntimeException(e);
      }
    } else if (base64Key != null && !base64Key.trim().isEmpty()) {
      try {
        byte[] keyBytes = Base64.getDecoder().decode(base64Key.trim());
        CryptoConverter.setKey(new javax.crypto.spec.SecretKeySpec(keyBytes, "AES"), null);
        log.info("Database security configuration initialized with production encryption key.");
      } catch (Exception e) {
        log.error("Failed to initialize database security configuration key", e);
        throw new RuntimeException(e);
      }
    } else {
      log.warn(
          "smdp.db-encryption-key was not provided. Using fallback development key for database encryption.");
    }
  }
}
