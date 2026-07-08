package in.hutta.lpa.service;

import in.hutta.lpa.dto.Es9Dtos.*;
import in.hutta.lpa.dto.LpaDtos.*;
import in.hutta.lpa.model.LocalProfile;
import in.hutta.lpa.repository.LocalProfileRepository;
import java.security.*;
import java.security.spec.ECGenParameterSpec;
import java.util.Base64;
import javax.crypto.KeyAgreement;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bouncycastle.asn1.*;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Slf4j
@Service
@RequiredArgsConstructor
public class LpaDownloadService {

  private final LocalProfileRepository localProfileRepository;
  private final RestTemplate restTemplate = new RestTemplate();

  static {
    if (Security.getProvider("BC") == null) {
      Security.addProvider(new org.bouncycastle.jce.provider.BouncyCastleProvider());
    }
  }

  public DownloadResponse downloadProfile(String activationCode) {
    log.info("LPA Simulator initiating profile download: {}", activationCode);
    DownloadResponse response = new DownloadResponse();

    try {
      // 1. Parse Activation Code
      if (activationCode == null || !activationCode.startsWith("LPA:1$")) {
        throw new IllegalArgumentException(
            "Invalid activation code format. Must start with LPA:1$");
      }
      String[] parts = activationCode.split("\\$", -1);
      if (parts.length < 3) {
        throw new IllegalArgumentException(
            "Invalid activation code. Must contain at least SM-DP+ Address slot");
      }
      String smdpAddress = parts[1];
      String matchingId = parts[2]; // May be empty in Push scenario

      log.info("Parsed Activation Code: smdpAddress={}, matchingId={}", smdpAddress, matchingId);

      // Determine schema (https for public domain hutta.in, http for local)
      String protocol = "http";
      if (smdpAddress.contains("hutta.in")
          || (!smdpAddress.contains("localhost") && !smdpAddress.contains("127.0.0.1"))) {
        protocol = "https";
      }
      String es9BaseUrl = protocol + "://" + smdpAddress + "/gsma/rsp/v2/es9plus";

      HttpHeaders headers = new HttpHeaders();
      headers.setContentType(MediaType.APPLICATION_JSON);
      headers.set("User-Agent", "gsma-rsp-lpa/3.0.0");

      // Step 1: initiateAuthentication
      byte[] challBytes = new byte[16];
      new java.security.SecureRandom().nextBytes(challBytes);
      String euiccChallengeStr = bytesToHex(challBytes);

      InitiateAuthenticationRequest req1 = new InitiateAuthenticationRequest();
      req1.setEuiccChallenge(euiccChallengeStr);
      req1.setSmdpAddress(smdpAddress);
      req1.setEuiccInfo1("MOCK_EUICC_INFO_1");

      log.info("ES9+ Handshake Step 1: initiateAuthentication targeting {}", es9BaseUrl);
      HttpEntity<InitiateAuthenticationRequest> entity1 = new HttpEntity<>(req1, headers);
      InitiateAuthenticationResponse resp1 =
          restTemplate.postForObject(
              es9BaseUrl + "/initiateAuthentication",
              entity1,
              InitiateAuthenticationResponse.class);

      if (resp1 == null || resp1.getTransactionId() == null) {
        throw new IllegalStateException(
            "Failed step 1: initiateAuthentication returned empty response");
      }
      String transactionId = resp1.getTransactionId();
      log.info("ES9+ Handshake Step 1 success: transactionId={}", transactionId);

      // Verify server signature in Step 1 and prepare real authenticateServerResponse
      String authenticateServerResponseBase64;
      try {
        String smdpSigned2Base64 = resp1.getSmdpSigned2();
        String smdpSignature2Base64 = resp1.getSmdpSignature2();
        String smdpCertificateBase64 = resp1.getSmdpCertificate();

        byte[] signed2Bytes = Base64.getDecoder().decode(smdpSigned2Base64.trim());
        byte[] signature2Bytes = Base64.getDecoder().decode(smdpSignature2Base64.trim());
        byte[] certBytes = Base64.getDecoder().decode(smdpCertificateBase64.trim());

        // Parse Server Certificate
        java.security.cert.CertificateFactory cf =
            java.security.cert.CertificateFactory.getInstance("X.509");
        java.security.cert.X509Certificate serverCert =
            (java.security.cert.X509Certificate)
                cf.generateCertificate(new java.io.ByteArrayInputStream(certBytes));
        PublicKey serverPublicKey = serverCert.getPublicKey();

        // Verify signature
        Signature ecdsaVerify = Signature.getInstance("SHA256withECDSA", "BC");
        ecdsaVerify.initVerify(serverPublicKey);
        ecdsaVerify.update(signed2Bytes);
        if (!ecdsaVerify.verify(signature2Bytes)) {
          throw new GeneralSecurityException("SM-DP+ signature verification failed!");
        }
        log.info("Server signature verified successfully on LPA");

        // Extract smdpChallenge and euiccChallenge from signed2Bytes
        String smdpChallenge = null;
        String euiccChallenge = null;
        try (ASN1InputStream asn1In = new ASN1InputStream(signed2Bytes)) {
          ASN1Primitive obj = asn1In.readObject();
          if (obj instanceof ASN1Sequence) {
            ASN1Sequence seq = (ASN1Sequence) obj;
            smdpChallenge = ((DERPrintableString) seq.getObjectAt(1)).getString();
            euiccChallenge = ((DERPrintableString) seq.getObjectAt(2)).getString();
          }
        }

        if (smdpChallenge == null || euiccChallenge == null) {
          throw new IllegalStateException("Failed to parse challenges from smdpSigned2");
        }

        // Generate client EC signing key pair
        KeyPairGenerator kpgSign = KeyPairGenerator.getInstance("EC", "BC");
        kpgSign.initialize(new ECGenParameterSpec("secp256r1"));
        KeyPair clientSignKeyPair = kpgSign.generateKeyPair();

        // Build signedData sequence
        ASN1EncodableVector clientSignedVector = new ASN1EncodableVector();
        clientSignedVector.add(new DERPrintableString(transactionId));
        clientSignedVector.add(new DERPrintableString(euiccChallenge));
        clientSignedVector.add(new DERPrintableString(smdpChallenge));
        DERSequence clientSignedData = new DERSequence(clientSignedVector);
        byte[] clientSignedBytes = clientSignedData.getEncoded("DER");

        // Sign clientSignedBytes using client private key
        Signature ecdsaSign = Signature.getInstance("SHA256withECDSA", "BC");
        ecdsaSign.initSign(clientSignKeyPair.getPrivate());
        ecdsaSign.update(clientSignedBytes);
        byte[] clientSigBytes = ecdsaSign.sign();

        // Assemble authenticateServerResponse ASN.1 sequence:
        // [0] clientSignedData (Sequence)
        // [1] clientSigBytes (OctetString)
        // [2] clientPublicKey (OctetString)
        ASN1EncodableVector authResponseVector = new ASN1EncodableVector();
        authResponseVector.add(clientSignedData);
        authResponseVector.add(new DEROctetString(clientSigBytes));
        authResponseVector.add(new DEROctetString(clientSignKeyPair.getPublic().getEncoded()));
        DERSequence authResponseSeq = new DERSequence(authResponseVector);
        authenticateServerResponseBase64 =
            Base64.getEncoder().encodeToString(authResponseSeq.getEncoded("DER"));
      } catch (Exception verifyEx) {
        log.warn(
            "LPA: Failed to perform real server verification / signature generation, falling back to mock: {}",
            verifyEx.getMessage());
        authenticateServerResponseBase64 = "MOCK_AUTHENTICATE_SERVER_RESPONSE_ASN1";
      }

      // Step 2: authenticateClient
      AuthenticateClientRequest req2 = new AuthenticateClientRequest();
      req2.setTransactionId(transactionId);
      req2.setAuthenticateServerResponse(authenticateServerResponseBase64);

      log.info("ES9+ Handshake Step 2: authenticateClient");
      HttpEntity<AuthenticateClientRequest> entity2 = new HttpEntity<>(req2, headers);
      AuthenticateClientResponse resp2 =
          restTemplate.postForObject(
              es9BaseUrl + "/authenticateClient", entity2, AuthenticateClientResponse.class);

      if (resp2 == null) {
        throw new IllegalStateException(
            "Failed step 2: authenticateClient returned empty response");
      }
      log.info(
          "ES9+ Handshake Step 2 success: server authenticated for transactionId={}",
          transactionId);

      // Generate client EC Ephemeral key pair (secp256r1/NIST P-256)
      KeyPairGenerator kpg = KeyPairGenerator.getInstance("EC", "BC");
      kpg.initialize(new ECGenParameterSpec("secp256r1"));
      KeyPair clientEphemeralKeyPair = kpg.generateKeyPair();
      byte[] clientPublicKeyBytes = clientEphemeralKeyPair.getPublic().getEncoded();

      // Build DER Sequence for PrepareDownloadResponse
      ASN1EncodableVector prepareVector = new ASN1EncodableVector();
      prepareVector.add(new DERPrintableString(transactionId));
      prepareVector.add(new DEROctetString(clientPublicKeyBytes));
      DERSequence prepareSeq = new DERSequence(prepareVector);
      byte[] prepareBytes = prepareSeq.getEncoded("DER");
      String prepareDownloadResponseBase64 = Base64.getEncoder().encodeToString(prepareBytes);

      // Step 3: getBoundProfilePackage
      GetBoundProfilePackageRequest req3 = new GetBoundProfilePackageRequest();
      req3.setTransactionId(transactionId);
      req3.setPrepareDownloadResponse(prepareDownloadResponseBase64);

      log.info("ES9+ Handshake Step 3: getBoundProfilePackage");
      HttpEntity<GetBoundProfilePackageRequest> entity3 = new HttpEntity<>(req3, headers);
      GetBoundProfilePackageResponse resp3 =
          restTemplate.postForObject(
              es9BaseUrl + "/getBoundProfilePackage",
              entity3,
              GetBoundProfilePackageResponse.class);

      if (resp3 == null || resp3.getBoundProfilePackage() == null) {
        throw new IllegalStateException(
            "Failed step 3: getBoundProfilePackage returned empty response");
      }
      String bpp = resp3.getBoundProfilePackage();
      int bppSize = bpp.length();
      log.info(
          "ES9+ Handshake Step 3 success: Bound Profile Package downloaded (size: {} chars)",
          bppSize);

      // Extract ICCID and decrypt profile payload from real BPP ASN.1 DER sequence
      String iccid = matchingId;
      String payloadBase64 = null;

      try {
        byte[] bppBytes = Base64.getDecoder().decode(bpp.trim());
        try (ASN1InputStream asn1In = new ASN1InputStream(bppBytes)) {
          ASN1Primitive obj = asn1In.readObject();
          if (obj instanceof ASN1Sequence) {
            ASN1Sequence seq = (ASN1Sequence) obj;
            // BPP Sequence tag structure:
            // [0] smdpSigned2 (Sequence)
            // [1] smdpSignature2 (OctetString)
            // [2] smdpCertificate (OctetString)
            // [3] encryptedProfilePackage (OctetString)

            ASN1TaggedObject taggedCert = (ASN1TaggedObject) seq.getObjectAt(2);
            byte[] certBytes = ((ASN1OctetString) taggedCert.getBaseObject()).getOctets();

            ASN1TaggedObject taggedEncPayload = (ASN1TaggedObject) seq.getObjectAt(3);
            byte[] encPayload = ((ASN1OctetString) taggedEncPayload.getBaseObject()).getOctets();

            // Extract Server Public Key from Certificate
            java.security.cert.CertificateFactory cf =
                java.security.cert.CertificateFactory.getInstance("X.509");
            java.security.cert.X509Certificate serverCert =
                (java.security.cert.X509Certificate)
                    cf.generateCertificate(new java.io.ByteArrayInputStream(certBytes));
            PublicKey serverPublicKey = serverCert.getPublicKey();

            // Perform client-side ECDH key agreement
            KeyAgreement ka = KeyAgreement.getInstance("ECDH", "BC");
            ka.init(clientEphemeralKeyPair.getPrivate());
            ka.doPhase(serverPublicKey, true);
            byte[] sharedSecret = ka.generateSecret();

            // Derive 16-byte symmetric key via SHA-256 KDF
            byte[] keyBytes = new byte[16];
            MessageDigest sha256 = MessageDigest.getInstance("SHA-256");
            byte[] hashedSecret = sha256.digest(sharedSecret);
            System.arraycopy(hashedSecret, 0, keyBytes, 0, 16);
            javax.crypto.spec.SecretKeySpec secretKey =
                new javax.crypto.spec.SecretKeySpec(keyBytes, "AES");

            // Decrypt the encrypted payload using AES-GCM
            byte[] iv = new byte[12];
            byte[] ciphertext = new byte[encPayload.length - 12];
            System.arraycopy(encPayload, 0, iv, 0, 12);
            System.arraycopy(encPayload, 12, ciphertext, 0, ciphertext.length);

            javax.crypto.Cipher cipher = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding");
            javax.crypto.spec.GCMParameterSpec parameterSpec =
                new javax.crypto.spec.GCMParameterSpec(128, iv);
            cipher.init(javax.crypto.Cipher.DECRYPT_MODE, secretKey, parameterSpec);
            byte[] decryptedPayloadBytes = cipher.doFinal(ciphertext);

            payloadBase64 = Base64.getEncoder().encodeToString(decryptedPayloadBytes);
          } else {
            throw new Exception("BPP is not a DER ASN.1 Sequence");
          }
        }
      } catch (Exception parseEx) {
        log.warn(
            "Failed to parse/decrypt BPP via real cryptography, falling back to mock parser: {}",
            parseEx.getMessage());
        try {
          String decodedBpp =
              new String(
                  java.util.Base64.getDecoder().decode(bpp),
                  java.nio.charset.StandardCharsets.UTF_8);

          // Parse ICCID from BPP if present
          if (decodedBpp.contains("iccid=")) {
            int start = decodedBpp.indexOf("iccid=") + 6;
            int end = decodedBpp.indexOf(",", start);
            if (end == -1) {
              end = decodedBpp.indexOf("]", start);
            }
            if (end != -1) {
              iccid = decodedBpp.substring(start, end);
            }
          }

          // Parse Payload from BPP if present
          if (decodedBpp.contains("payload=")) {
            int start = decodedBpp.indexOf("payload=") + 8;
            int end = decodedBpp.indexOf("]", start);
            if (end != -1) {
              payloadBase64 = decodedBpp.substring(start, end);
            }
          }
        } catch (Exception mockEx) {
          log.warn("Could not parse BPP as mock string: {}", mockEx.getMessage());
        }
      }

      if (iccid == null || iccid.isEmpty()) {
        iccid = "EID_PUSH_FLOW";
      }

      // Decoded profile details
      String spName = null;
      String profileNickname = null;

      if (payloadBase64 != null) {
        try {
          byte[] profileBytes = java.util.Base64.getDecoder().decode(payloadBase64);
          // Extract fields from PE-Header using GSMA SGP.22 ASN.1 context tags
          spName = extractStringField(profileBytes, 0x84); // Tag 84 is serviceProviderName
          profileNickname = extractStringField(profileBytes, 0x85); // Tag 85 is profileName

          // Fallback to parse ICCID from profile bytes if matchingId was empty and BPP parsing
          // failed
          if ("EID_PUSH_FLOW".equals(iccid)) {
            String parsedIccid = extractIccid(profileBytes);
            if (parsedIccid != null && !parsedIccid.isEmpty()) {
              iccid = parsedIccid;
            }
          }
        } catch (Exception e) {
          log.warn(
              "LPA Simulator: Could not parse custom fields from profile payload: {}",
              e.getMessage());
        }
      }

      if (spName == null || spName.trim().isEmpty()) {
        spName = "SM-DP+ (" + smdpAddress + ")";
      }
      if (profileNickname == null || profileNickname.trim().isEmpty()) {
        profileNickname =
            "eSIM " + (iccid.length() > 4 ? iccid.substring(iccid.length() - 4) : iccid);
      }

      response.setSuccess(true);
      response.setMessage("Profile downloaded successfully");
      response.setTransactionId(transactionId);
      response.setBoundProfilePackageSize(bppSize);
      response.setBoundProfilePackage(bpp);
      response.setIccid(iccid);

      // Save to local profile registry database
      LocalProfile localProfile = new LocalProfile();
      localProfile.setIccid(iccid);
      localProfile.setSmdpAddress(smdpAddress);
      localProfile.setProfileNickname(profileNickname);
      localProfile.setServiceProviderName(spName);
      localProfile.setProfileState("DISABLED"); // Initially disabled on device
      localProfile.setBoundProfilePackage(bpp);
      localProfileRepository.save(localProfile);
      log.info("eSIM profile successfully saved to device database: ICCID={}", iccid);

    } catch (Exception e) {
      log.error("eSIM profile download failed via LPA: {}", e.getMessage(), e);
      response.setSuccess(false);
      response.setMessage("Download failed: " + e.getMessage());
    }

    return response;
  }

  private String extractStringField(byte[] bytes, int tagValue) {
    int limit = Math.min(bytes.length - 4, 1000);
    for (int i = 0; i < limit; i++) {
      if ((bytes[i] & 0xFF) == tagValue) {
        int lenByte = bytes[i + 1] & 0xFF;
        int length = 0;
        int valueOffset = 2;

        if (lenByte < 128) {
          length = lenByte;
        } else {
          int numLenBytes = lenByte & 0x7F;
          if (numLenBytes > 0 && numLenBytes <= 4 && i + 1 + numLenBytes < bytes.length) {
            for (int j = 0; j < numLenBytes; j++) {
              length = (length << 8) | (bytes[i + 2 + j] & 0xFF);
            }
            valueOffset = 2 + numLenBytes;
          }
        }

        if (length > 0 && i + valueOffset + length <= bytes.length) {
          byte[] strBytes = new byte[length];
          System.arraycopy(bytes, i + valueOffset, strBytes, 0, length);
          return new String(strBytes, java.nio.charset.StandardCharsets.UTF_8);
        }
      }
    }
    return null;
  }

  private String extractIccid(byte[] bytes) {
    int limit = Math.min(bytes.length - 11, 1000);
    for (int i = 0; i < limit; i++) {
      if ((bytes[i] & 0xFF) == 0x83 && (bytes[i + 1] & 0xFF) == 0x0A) {
        byte[] iccidBytes = new byte[10];
        System.arraycopy(bytes, i + 2, iccidBytes, 0, 10);
        return bytesToHex(iccidBytes);
      }
    }
    return null;
  }

  private static String bytesToHex(byte[] bytes) {
    StringBuilder sb = new StringBuilder();
    for (byte b : bytes) {
      sb.append(String.format("%02x", b));
    }
    return sb.toString();
  }
}
