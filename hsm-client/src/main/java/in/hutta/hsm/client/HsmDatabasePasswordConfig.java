package in.hutta.hsm.client;

import in.hutta.hsm.provider.HuttaHsmProvider;
import java.security.KeyStore;
import java.security.Security;
import java.util.HashMap;
import java.util.Map;
import javax.crypto.SecretKey;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

public class HsmDatabasePasswordConfig implements EnvironmentPostProcessor {
  private static final Logger log = LoggerFactory.getLogger(HsmDatabasePasswordConfig.class);

  @Override
  public void postProcessEnvironment(
      ConfigurableEnvironment environment, SpringApplication application) {
    String enabledStr = environment.getProperty("smdp.hsm.enabled");
    if (!"true".equalsIgnoreCase(enabledStr)) {
      return;
    }

    String hsmUrl = environment.getProperty("smdp.hsm.url", "http://localhost:8096");
    String hsmPin = environment.getProperty("smdp.hsm.pin", "1234");
    String appName = environment.getProperty("spring.application.name");

    String alias;
    if ("smdp-plus".equalsIgnoreCase(appName)) {
      alias = "smdp-db-pass";
    } else if ("lpa-simulator".equalsIgnoreCase(appName)) {
      alias = "lpa-db-pass";
    } else if ("blog-service".equalsIgnoreCase(appName)) {
      alias = "blog-db-pass";
    } else if ("monitor-service".equalsIgnoreCase(appName)) {
      alias = "monitor-db-pass";
    } else {
      return;
    }

    log.info("[*] Connecting to Network HSM to fetch database password for alias: {}", alias);

    try {
      HuttaHsmProvider provider = new HuttaHsmProvider(hsmUrl, hsmPin);
      Security.addProvider(provider);

      KeyStore ks = KeyStore.getInstance("PKCS11", provider);
      ks.load(null, hsmPin.toCharArray());

      SecretKey key = (SecretKey) ks.getKey(alias, null);
      if (key != null && key.getEncoded() != null) {
        String dbPassword = new String(key.getEncoded(), java.nio.charset.StandardCharsets.UTF_8);
        Map<String, Object> hsmProps = new HashMap<>();
        hsmProps.put("spring.datasource.password", dbPassword);

        environment
            .getPropertySources()
            .addFirst(new MapPropertySource("hsmPropertySource", hsmProps));
        log.info("[+] Successfully resolved database password from HSM for {}", alias);
      } else {
        log.error("[-] Database password alias '{}' not found in HSM or not extractable.", alias);
      }
    } catch (Exception e) {
      log.error("[-] Failed to retrieve database password from HSM: {}", e.getMessage(), e);
      throw new RuntimeException("Critical: Failed to retrieve database password from HSM", e);
    }
  }
}
