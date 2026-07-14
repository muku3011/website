package in.hutta.hsm.provider;

import javax.crypto.SecretKey;

public class HuttaHsmGenericSecretKey implements SecretKey {
  private final String alias;
  private final String algorithm;
  private final byte[] encoded;

  public HuttaHsmGenericSecretKey(String alias, String algorithm, byte[] encoded) {
    this.alias = alias;
    this.algorithm = algorithm;
    this.encoded = encoded;
  }

  public String getAlias() {
    return alias;
  }

  @Override
  public String getAlgorithm() {
    return algorithm;
  }

  @Override
  public String getFormat() {
    return "RAW";
  }

  @Override
  public byte[] getEncoded() {
    return encoded;
  }
}
