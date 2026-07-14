package in.hutta.hsm.provider;

import in.hutta.hsm.client.HsmRestClient;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.SignatureSpi;

public class HuttaHsmSignatureSpi extends SignatureSpi {
  private HuttaHsmPrivateKey privateKey;
  private final java.io.ByteArrayOutputStream buffer = new java.io.ByteArrayOutputStream();

  @Override
  protected void engineInitVerify(PublicKey publicKey) {
    throw new UnsupportedOperationException(
        "Verification is done using standard software JCA provider.");
  }

  @Override
  protected void engineInitSign(PrivateKey privateKey) {
    if (!(privateKey instanceof HuttaHsmPrivateKey)) {
      throw new IllegalArgumentException("Key must be a HuttaHsmPrivateKey");
    }
    this.privateKey = (HuttaHsmPrivateKey) privateKey;
    this.buffer.reset();
  }

  @Override
  protected void engineUpdate(byte b) {
    buffer.write(b);
  }

  @Override
  protected void engineUpdate(byte[] b, int off, int len) {
    if (b != null && len > 0) {
      buffer.write(b, off, len);
    }
  }

  @Override
  protected byte[] engineSign() {
    byte[] data = buffer.toByteArray();
    buffer.reset();
    return HsmRestClient.performSignOperation(privateKey.getAlias(), data);
  }

  @Override
  protected boolean engineVerify(byte[] sigBytes) {
    throw new UnsupportedOperationException(
        "Verification is done using standard software JCA provider.");
  }

  @Override
  protected void engineSetParameter(String param, Object value) {}

  @Override
  protected Object engineGetParameter(String param) {
    return null;
  }
}
