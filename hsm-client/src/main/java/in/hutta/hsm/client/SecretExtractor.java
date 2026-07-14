package in.hutta.hsm.client;

import in.hutta.hsm.provider.HuttaHsmProvider;
import java.security.KeyStore;
import java.security.Security;
import javax.crypto.SecretKey;

public class SecretExtractor {
  public static void main(String[] args) {
    if (args.length < 1) {
      System.err.println("Usage: java SecretExtractor <key-alias> [hsm-url] [hsm-pin]");
      System.exit(1);
    }
    String alias = args[0];

    String hsmUrl = args.length > 1 ? args[1] : System.getenv("SMDP_HSM_URL");
    String hsmPin = args.length > 2 ? args[2] : System.getenv("SMDP_HSM_PIN");

    if (hsmUrl == null || hsmUrl.trim().isEmpty()) {
      hsmUrl = "http://localhost:8096";
    }
    if (hsmPin == null || hsmPin.trim().isEmpty()) {
      hsmPin = "1234";
    }

    try {
      HuttaHsmProvider provider = new HuttaHsmProvider(hsmUrl, hsmPin);
      Security.addProvider(provider);

      KeyStore ks = KeyStore.getInstance("PKCS11", provider);
      ks.load(null, hsmPin.toCharArray());

      SecretKey key = (SecretKey) ks.getKey(alias, null);
      if (key == null) {
        System.err.println("Error: Secret '" + alias + "' not found in HSM.");
        System.exit(1);
        return;
      }

      byte[] encoded = key.getEncoded();
      if (encoded == null) {
        System.err.println("Error: Secret '" + alias + "' is not extractable.");
        System.exit(1);
      }

      System.out.print(new String(encoded, java.nio.charset.StandardCharsets.UTF_8));
    } catch (Exception e) {
      System.err.println("Error: Failed to retrieve secret from HSM: " + e.getMessage());
      System.exit(1);
    }
  }
}
