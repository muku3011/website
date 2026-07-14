package in.hutta.hsm.provider;

import in.hutta.hsm.client.HsmRestClient;
import java.io.InputStream;
import java.io.OutputStream;
import java.security.Key;
import java.security.KeyStoreSpi;
import java.security.cert.Certificate;
import java.security.cert.CertificateFactory;
import java.util.Base64;
import java.util.Collections;
import java.util.Date;
import java.util.Enumeration;
import java.util.Map;

public class HuttaHsmKeyStoreSpi extends KeyStoreSpi {

  @Override
  @SuppressWarnings("unchecked")
  public Key engineGetKey(String alias, char[] password) {
    try {
      Map<String, Object> metadata = HsmRestClient.getKeyMetadata(alias);
      if (metadata == null || metadata.isEmpty() || metadata.containsKey("error")) {
        return null;
      }
      String type = (String) metadata.get("objectType");
      String algorithm = (String) metadata.get("algorithm");

      if ("SECRET_KEY".equals(type)) {
        Map<String, Object> attrs = (Map<String, Object>) metadata.get("attributes");
        boolean extractable = attrs != null && Boolean.TRUE.equals(attrs.get("CKA_EXTRACTABLE"));
        if (extractable) {
          String keyMaterialBase64 = (String) metadata.get("keyMaterial");
          if (keyMaterialBase64 != null) {
            byte[] rawBytes = Base64.getDecoder().decode(keyMaterialBase64);
            return new HuttaHsmGenericSecretKey(alias, algorithm, rawBytes);
          }
        }
        return new HuttaHsmSecretKey(alias, algorithm);
      } else if ("PRIVATE_KEY".equals(type)) {
        return new HuttaHsmPrivateKey(alias, algorithm);
      }
      return null;
    } catch (Exception e) {
      throw new RuntimeException("Failed to get key from HSM: " + alias, e);
    }
  }

  @Override
  public Certificate[] engineGetCertificateChain(String alias) {
    Certificate cert = engineGetCertificate(alias);
    return cert != null ? new Certificate[] {cert} : new Certificate[0];
  }

  @Override
  public Certificate engineGetCertificate(String alias) {
    try {
      Map<String, Object> metadata = HsmRestClient.getKeyMetadata(alias);
      if (metadata == null || metadata.isEmpty() || !metadata.containsKey("certificateData")) {
        return null;
      }
      String certBase64 = (String) metadata.get("certificateData");
      if (certBase64 == null || certBase64.trim().isEmpty()) {
        return null;
      }
      byte[] certBytes = Base64.getDecoder().decode(certBase64.trim());
      CertificateFactory cf = CertificateFactory.getInstance("X.509");
      return cf.generateCertificate(new java.io.ByteArrayInputStream(certBytes));
    } catch (Exception e) {
      return null;
    }
  }

  @Override
  public Date engineGetCreationDate(String alias) {
    return new Date();
  }

  @Override
  public void engineSetKeyEntry(String alias, Key key, char[] password, Certificate[] chain) {}

  @Override
  public void engineSetKeyEntry(String alias, byte[] key, Certificate[] chain) {}

  @Override
  public void engineSetCertificateEntry(String alias, Certificate cert) {}

  @Override
  public void engineDeleteEntry(String alias) {}

  @Override
  public Enumeration<String> engineAliases() {
    return Collections.emptyEnumeration();
  }

  @Override
  public boolean engineContainsAlias(String alias) {
    try {
      return HsmRestClient.getKeyMetadata(alias) != null;
    } catch (Exception e) {
      return false;
    }
  }

  @Override
  public int engineSize() {
    return 0;
  }

  @Override
  public boolean engineIsKeyEntry(String alias) {
    return engineContainsAlias(alias);
  }

  @Override
  public boolean engineIsCertificateEntry(String alias) {
    return engineGetCertificate(alias) != null;
  }

  @Override
  public String engineGetCertificateAlias(Certificate cert) {
    return null;
  }

  @Override
  public void engineStore(OutputStream stream, char[] password) {}

  @Override
  public void engineLoad(InputStream stream, char[] password) {
    if (password != null) {
      HsmRestClient.login(new String(password));
    }
  }
}
