package in.hutta.smdp.config;

import in.hutta.smdp.util.CryptoConverter;
import jakarta.annotation.PostConstruct;
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

  @PostConstruct
  public void init() {
    if (base64Key != null && !base64Key.trim().isEmpty()) {
      try {
        byte[] keyBytes = Base64.getDecoder().decode(base64Key.trim());
        CryptoConverter.setKey(keyBytes);
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
