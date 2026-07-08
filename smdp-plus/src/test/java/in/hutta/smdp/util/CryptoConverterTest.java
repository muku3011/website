package in.hutta.smdp.util;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

public class CryptoConverterTest {

  @Test
  public void testEncryptionAndDecryptionWithDefaultKey() {
    CryptoConverter converter = new CryptoConverter();
    String plaintext = "Hello World! This is a sensitive eSIM profile payload.";

    String ciphertext = converter.convertToDatabaseColumn(plaintext);
    assertThat(ciphertext).isNotNull();
    assertThat(ciphertext).isNotEqualTo(plaintext);

    String decrypted = converter.convertToEntityAttribute(ciphertext);
    assertThat(decrypted).isEqualTo(plaintext);
  }

  @Test
  public void testEncryptionAndDecryptionWithCustomKey() {
    // Generate a secure random 32-byte key
    byte[] customKey = new byte[32];
    for (int i = 0; i < 32; i++) {
      customKey[i] = (byte) (i + 10);
    }
    CryptoConverter.setKey(customKey);

    CryptoConverter converter = new CryptoConverter();
    String plaintext = "Secret payload 12345";

    String ciphertext = converter.convertToDatabaseColumn(plaintext);
    assertThat(ciphertext).isNotNull();
    assertThat(ciphertext).isNotEqualTo(plaintext);

    String decrypted = converter.convertToEntityAttribute(ciphertext);
    assertThat(decrypted).isEqualTo(plaintext);

    // Reset key to default
    byte[] defaultKey = new byte[32];
    for (int i = 0; i < 32; i++) {
      defaultKey[i] = (byte) (i * 7);
    }
    CryptoConverter.setKey(defaultKey);
  }
}
