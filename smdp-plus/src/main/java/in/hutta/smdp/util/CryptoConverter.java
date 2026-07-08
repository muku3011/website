package in.hutta.smdp.util;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

@Converter
public class CryptoConverter implements AttributeConverter<String, String> {

  private static final String ALGORITHM = "AES/GCM/NoPadding";
  private static final int GCM_IV_LENGTH = 12;
  private static final int GCM_TAG_LENGTH = 128;

  private static SecretKeySpec secretKey;
  private final SecureRandom random = new SecureRandom();

  public static void setKey(byte[] keyBytes) {
    if (keyBytes.length != 32) {
      throw new IllegalArgumentException("Key must be a 256-bit (32 bytes) AES key");
    }
    secretKey = new SecretKeySpec(keyBytes, "AES");
  }

  public CryptoConverter() {
    // If not configured by the application lifecycle, initialize with a safe default key for
    // testing/dev
    if (secretKey == null) {
      byte[] keyBytes = new byte[32];
      for (int i = 0; i < 32; i++) {
        keyBytes[i] = (byte) (i * 7);
      }
      secretKey = new SecretKeySpec(keyBytes, "AES");
    }
  }

  @Override
  public String convertToDatabaseColumn(String attribute) {
    if (attribute == null) {
      return null;
    }
    try {
      byte[] iv = new byte[GCM_IV_LENGTH];
      random.nextBytes(iv);

      Cipher cipher = Cipher.getInstance(ALGORITHM);
      GCMParameterSpec parameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
      cipher.init(Cipher.ENCRYPT_MODE, secretKey, parameterSpec);

      byte[] ciphertext =
          cipher.doFinal(attribute.getBytes(java.nio.charset.StandardCharsets.UTF_8));
      byte[] encrypted = new byte[GCM_IV_LENGTH + ciphertext.length];
      System.arraycopy(iv, 0, encrypted, 0, GCM_IV_LENGTH);
      System.arraycopy(ciphertext, 0, encrypted, GCM_IV_LENGTH, ciphertext.length);

      return Base64.getEncoder().encodeToString(encrypted);
    } catch (Exception e) {
      throw new RuntimeException("Failed to encrypt attribute", e);
    }
  }

  @Override
  public String convertToEntityAttribute(String dbData) {
    if (dbData == null) {
      return null;
    }
    try {
      byte[] encrypted = Base64.getDecoder().decode(dbData);
      if (encrypted.length < GCM_IV_LENGTH) {
        throw new IllegalArgumentException("Encrypted data is too short");
      }

      byte[] iv = new byte[GCM_IV_LENGTH];
      byte[] ciphertext = new byte[encrypted.length - GCM_IV_LENGTH];
      System.arraycopy(encrypted, 0, iv, 0, GCM_IV_LENGTH);
      System.arraycopy(encrypted, GCM_IV_LENGTH, ciphertext, 0, ciphertext.length);

      Cipher cipher = Cipher.getInstance(ALGORITHM);
      GCMParameterSpec parameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
      cipher.init(Cipher.DECRYPT_MODE, secretKey, parameterSpec);

      byte[] plaintextBytes = cipher.doFinal(ciphertext);
      return new String(plaintextBytes, java.nio.charset.StandardCharsets.UTF_8);
    } catch (Exception e) {
      throw new RuntimeException("Failed to decrypt attribute", e);
    }
  }
}
