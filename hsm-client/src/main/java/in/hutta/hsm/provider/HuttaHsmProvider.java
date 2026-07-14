package in.hutta.hsm.provider;

import java.security.Provider;

public class HuttaHsmProvider extends Provider {
  public HuttaHsmProvider() {
    this(
        System.getenv("SMDP_HSM_URL") != null
            ? System.getenv("SMDP_HSM_URL")
            : "http://localhost:8096",
        System.getenv("SMDP_HSM_PIN") != null ? System.getenv("SMDP_HSM_PIN") : "1234");
  }

  public HuttaHsmProvider(String hsmUrl, String pin) {
    super("HuttaPKCS11", "1.0", "Hutta Simulated PKCS11 Provider");

    // Register standard KeyStore of type "PKCS11"
    putService(
        new Provider.Service(
            this, "KeyStore", "PKCS11", HuttaHsmKeyStoreSpi.class.getName(), null, null));

    // Register standard Cipher for GCM
    putService(
        new Provider.Service(
            this, "Cipher", "AES/GCM/NoPadding", HuttaHsmCipherSpi.class.getName(), null, null));

    // Register standard Signature for ECDSA
    putService(
        new Provider.Service(
            this,
            "Signature",
            "SHA256withECDSA",
            HuttaHsmSignatureSpi.class.getName(),
            null,
            null));

    // Register standard KeyAgreement for ECDH
    putService(
        new Provider.Service(
            this, "KeyAgreement", "ECDH", HuttaHsmKeyAgreementSpi.class.getName(), null, null));

    HsmConnectionContext.init(hsmUrl, pin);
  }
}
