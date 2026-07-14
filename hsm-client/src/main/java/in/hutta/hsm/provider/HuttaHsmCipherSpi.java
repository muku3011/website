package in.hutta.hsm.provider;

import in.hutta.hsm.client.HsmRestClient;
import java.security.AlgorithmParameters;
import java.security.Key;
import java.security.SecureRandom;
import java.security.spec.AlgorithmParameterSpec;
import javax.crypto.CipherSpi;
import javax.crypto.spec.GCMParameterSpec;

public class HuttaHsmCipherSpi extends CipherSpi {
  private HuttaHsmSecretKey key;
  private int opmode;
  private byte[] iv;
  private int tagLength;
  private final java.io.ByteArrayOutputStream buffer = new java.io.ByteArrayOutputStream();

  @Override
  protected void engineSetMode(String mode) {
    if (!"GCM".equalsIgnoreCase(mode)) {
      throw new IllegalArgumentException("Only GCM mode supported");
    }
  }

  @Override
  protected void engineSetPadding(String padding) {
    if (!"NoPadding".equalsIgnoreCase(padding)) {
      throw new IllegalArgumentException("Only NoPadding supported");
    }
  }

  @Override
  protected int engineGetBlockSize() {
    return 16;
  }

  @Override
  protected int engineGetOutputSize(int inputLen) {
    return buffer.size() + inputLen + (opmode == 1 ? (tagLength / 8) : 0);
  }

  @Override
  protected byte[] engineGetIV() {
    return iv;
  }

  @Override
  protected AlgorithmParameters engineGetParameters() {
    return null;
  }

  @Override
  protected void engineInit(int opmode, Key key, SecureRandom random) {
    if (!(key instanceof HuttaHsmSecretKey)) {
      throw new IllegalArgumentException("Key must be a HuttaHsmSecretKey");
    }
    this.opmode = opmode;
    this.key = (HuttaHsmSecretKey) key;
    this.buffer.reset();
  }

  @Override
  protected void engineInit(
      int opmode, Key key, AlgorithmParameterSpec params, SecureRandom random) {
    if (!(key instanceof HuttaHsmSecretKey)) {
      throw new IllegalArgumentException("Key must be a HuttaHsmSecretKey");
    }
    this.opmode = opmode;
    this.key = (HuttaHsmSecretKey) key;
    if (params instanceof GCMParameterSpec) {
      GCMParameterSpec gcm = (GCMParameterSpec) params;
      this.iv = gcm.getIV();
      this.tagLength = gcm.getTLen();
    }
    this.buffer.reset();
  }

  @Override
  protected void engineInit(int opmode, Key key, AlgorithmParameters params, SecureRandom random) {
    engineInit(opmode, key, random);
  }

  @Override
  protected byte[] engineUpdate(byte[] input, int inputOffset, int inputLen) {
    if (input != null && inputLen > 0) {
      buffer.write(input, inputOffset, inputLen);
    }
    return new byte[0];
  }

  @Override
  protected int engineUpdate(
      byte[] input, int inputOffset, int inputLen, byte[] output, int outputOffset) {
    engineUpdate(input, inputOffset, inputLen);
    return 0;
  }

  @Override
  protected byte[] engineDoFinal(byte[] input, int inputOffset, int inputLen) {
    if (input != null && inputLen > 0) {
      buffer.write(input, inputOffset, inputLen);
    }
    byte[] data = buffer.toByteArray();
    buffer.reset();

    return HsmRestClient.performCipherOperation(opmode, key.getAlias(), iv, tagLength, data);
  }

  @Override
  protected int engineDoFinal(
      byte[] input, int inputOffset, int inputLen, byte[] output, int outputOffset) {
    byte[] result = engineDoFinal(input, inputOffset, inputLen);
    System.arraycopy(result, 0, output, outputOffset, result.length);
    return result.length;
  }
}
