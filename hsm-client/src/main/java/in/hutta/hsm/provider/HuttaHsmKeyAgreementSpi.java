package in.hutta.hsm.provider;

import in.hutta.hsm.client.HsmRestClient;
import java.security.Key;
import java.security.SecureRandom;
import java.security.spec.AlgorithmParameterSpec;
import javax.crypto.KeyAgreementSpi;
import javax.crypto.SecretKey;

public class HuttaHsmKeyAgreementSpi extends KeyAgreementSpi {
  private HuttaHsmPrivateKey privateKey;
  private byte[] peerPublicKeyBytes;

  @Override
  protected void engineInit(Key key, SecureRandom random) {
    if (!(key instanceof HuttaHsmPrivateKey)) {
      throw new IllegalArgumentException("Key must be a HuttaHsmPrivateKey");
    }
    this.privateKey = (HuttaHsmPrivateKey) key;
  }

  @Override
  protected void engineInit(Key key, AlgorithmParameterSpec params, SecureRandom random) {
    engineInit(key, random);
  }

  @Override
  protected Key engineDoPhase(Key key, boolean lastPhase) {
    if (key == null) {
      throw new IllegalArgumentException("Key cannot be null");
    }
    this.peerPublicKeyBytes = key.getEncoded();
    return null;
  }

  @Override
  protected byte[] engineGenerateSecret() {
    return HsmRestClient.performECDH(privateKey.getAlias(), peerPublicKeyBytes);
  }

  @Override
  protected int engineGenerateSecret(byte[] sharedSecret, int offset) {
    byte[] secret = engineGenerateSecret();
    System.arraycopy(secret, 0, sharedSecret, offset, secret.length);
    return secret.length;
  }

  @Override
  protected SecretKey engineGenerateSecret(String algorithm) {
    throw new UnsupportedOperationException(
        "ECDH shared secret generation as SecretKey object is not supported.");
  }
}
