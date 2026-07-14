package in.hutta.hsm.provider;

import java.security.PrivateKey;

public class HuttaHsmPrivateKey implements PrivateKey {
  private final String alias;
  private final String algorithm;

  public HuttaHsmPrivateKey(String alias, String algorithm) {
    this.alias = alias;
    this.algorithm = algorithm;
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
    return null;
  }

  @Override
  public byte[] getEncoded() {
    return null;
  }
}
