package in.hutta.eim.service;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.ECGenParameterSpec;
import java.util.Base64;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class EimCryptoService {

  private PrivateKey eimPrivateKey;
  private PublicKey eimPublicKey;

  public EimCryptoService() {
    try {
      // Generate EC key pair (secp256r1) to simulate safe key loading
      KeyPairGenerator keyGen = KeyPairGenerator.getInstance("EC");
      keyGen.initialize(new ECGenParameterSpec("secp256r1"));
      KeyPair pair = keyGen.generateKeyPair();
      this.eimPrivateKey = pair.getPrivate();
      this.eimPublicKey = pair.getPublic();
      log.info("eIM Cryptographic Service initialized with Elliptic Curve Key Pair.");
    } catch (Exception e) {
      log.error("Failed to initialize eIM Key Pair: {}", e.getMessage(), e);
    }
  }

  public String signTrigger(String data) {
    try {
      Signature ecdsa = Signature.getInstance("SHA256withECDSA");
      ecdsa.initSign(eimPrivateKey);
      ecdsa.update(data.getBytes());
      byte[] signature = ecdsa.sign();
      return Base64.getEncoder().encodeToString(signature);
    } catch (Exception e) {
      log.error("Failed to sign eIM trigger: {}", e.getMessage());
      return "MOCK_SIGNATURE_" + System.currentTimeMillis();
    }
  }

  public String getPublicKeyEncoded() {
    return Base64.getEncoder().encodeToString(eimPublicKey.getEncoded());
  }
}
