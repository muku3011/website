package in.hutta.smdp.service;

import static org.assertj.core.api.Assertions.assertThat;

import in.hutta.smdp.model.SessionContext;
import java.security.Signature;
import java.util.Base64;
import org.bouncycastle.asn1.ASN1EncodableVector;
import org.bouncycastle.asn1.DEROctetString;
import org.bouncycastle.asn1.DERPrintableString;
import org.bouncycastle.asn1.DERSequence;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
public class CryptoServiceTest {

  @Autowired private CryptoService cryptoService;

  private SessionContext session;

  @BeforeEach
  public void setUp() {
    session = cryptoService.createSession("mockEuiccChallenge", "localhost:8092");
    session.setIccid("89000123456789012399");
  }

  @Test
  public void testMockFallbackVerification() {
    // Plain text mock response should trigger the dynamic fallback and return true
    String mockResponse = "MOCK_EUICC_AUTHENTICATE_RESPONSE_SIGNATURE";
    boolean result = cryptoService.verifyEuiccSignature(session, mockResponse);

    assertThat(result).isTrue();
    // Since it fell back to mock mode, the session state should NOT be set to REAL_CRYPTO_ACTIVE
    assertThat(session.getState()).isNotEqualTo("REAL_CRYPTO_ACTIVE");
  }

  @Test
  public void testRealASN1DERVerification() throws Exception {
    // Build a mock eUICC signed data sequence
    ASN1EncodableVector signedVector = new ASN1EncodableVector();
    signedVector.add(new DERPrintableString(session.getTransactionId()));
    signedVector.add(new DERPrintableString("testSignedContent"));
    DERSequence signedData = new DERSequence(signedVector);
    byte[] signedBytes = signedData.getEncoded("DER");

    // Generate a real signature using the service's keypair for testing self-verification
    java.lang.reflect.Field field = CryptoService.class.getDeclaredField("smdpKeyPair");
    field.setAccessible(true);
    java.security.KeyPair keyPair = (java.security.KeyPair) field.get(cryptoService);

    Signature ecdsa = Signature.getInstance("SHA256withECDSA", "BC");
    ecdsa.initSign(keyPair.getPrivate());
    ecdsa.update(signedBytes);
    byte[] signatureBytes = ecdsa.sign();

    // Assemble the authenticateServerResponse sequence
    ASN1EncodableVector authResponseVector = new ASN1EncodableVector();
    authResponseVector.add(signedData);
    authResponseVector.add(new DEROctetString(signatureBytes));
    DERSequence authResponseSequence = new DERSequence(authResponseVector);

    String base64Response =
        Base64.getEncoder().encodeToString(authResponseSequence.getEncoded("DER"));

    // Execute verification - should parse as real DER and succeed
    boolean result = cryptoService.verifyEuiccSignature(session, base64Response);

    assertThat(result).isTrue();
    // The session state should now be updated to REAL_CRYPTO_ACTIVE
    assertThat(session.getState()).isEqualTo("REAL_CRYPTO_ACTIVE");
  }

  @Test
  public void testBoundProfilePackageMockMode() {
    // Mock mode (session state is not REAL_CRYPTO_ACTIVE)
    session.setState("INITIATED");
    String rawPayload = "MOCK_PROFILE_PAYLOAD_DER";
    String bpp =
        cryptoService.generateBoundProfilePackage(
            rawPayload, session, "MOCK_PREPARE_DOWNLOAD_RESPONSE");
    byte[] decoded = Base64.getDecoder().decode(bpp);
    String bppString = new String(decoded);

    // Should return the legacy format: BPP[transactionId=...,iccid=...,payload=...]
    assertThat(bppString).startsWith("BPP[");
    assertThat(bppString).contains("iccid=" + session.getIccid());
    assertThat(bppString).contains("payload=" + rawPayload);
  }

  @Test
  public void testBoundProfilePackageRealMode() throws Exception {
    // Real mode
    session.setState("REAL_CRYPTO_ACTIVE");
    String rawPayload = "REAL_PROFILE_PAYLOAD_BYTES";

    // Generate ephemeral client key pair for test
    java.security.KeyPairGenerator kpg = java.security.KeyPairGenerator.getInstance("EC", "BC");
    kpg.initialize(new java.security.spec.ECGenParameterSpec("secp256r1"));
    java.security.KeyPair clientKeyPair = kpg.generateKeyPair();

    org.bouncycastle.asn1.ASN1EncodableVector prepareVector =
        new org.bouncycastle.asn1.ASN1EncodableVector();
    prepareVector.add(new org.bouncycastle.asn1.DERPrintableString(session.getTransactionId()));
    prepareVector.add(
        new org.bouncycastle.asn1.DEROctetString(clientKeyPair.getPublic().getEncoded()));
    org.bouncycastle.asn1.DERSequence prepareSeq =
        new org.bouncycastle.asn1.DERSequence(prepareVector);
    String prepareDownloadResponse =
        Base64.getEncoder().encodeToString(prepareSeq.getEncoded("DER"));

    String bpp =
        cryptoService.generateBoundProfilePackage(rawPayload, session, prepareDownloadResponse);
    byte[] decoded = Base64.getDecoder().decode(bpp);

    // Parsing the generated BPP as ASN.1 DER sequence should succeed
    org.bouncycastle.asn1.ASN1InputStream asn1In =
        new org.bouncycastle.asn1.ASN1InputStream(decoded);
    org.bouncycastle.asn1.ASN1Primitive obj = asn1In.readObject();
    asn1In.close();

    assertThat(obj).isInstanceOf(org.bouncycastle.asn1.ASN1Sequence.class);
    org.bouncycastle.asn1.ASN1Sequence seq = (org.bouncycastle.asn1.ASN1Sequence) obj;

    // BPP has 4 tagged fields: smdpSigned2 [0], smdpSignature2 [1], smdpCertificate [2],
    // encPersonalisationData [3]
    assertThat(seq.size()).isEqualTo(4);
  }
}
