package in.hutta.smdp.service;

import in.hutta.smdp.model.SessionContext;
import org.bouncycastle.util.encoders.Hex;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class CryptoService {
    private static final Logger log = LoggerFactory.getLogger(CryptoService.class);
    private final SecureRandom random = new SecureRandom();
    
    // In-memory session context storage keyed by transactionId
    private final Map<String, SessionContext> sessions = new ConcurrentHashMap<>();

    public String generateTransactionId() {
        return UUID.randomUUID().toString().replace("-", "");
    }

    public String generateChallenge() {
        byte[] bytes = new byte[16];
        random.nextBytes(bytes);
        return Hex.toHexString(bytes);
    }

    public SessionContext createSession(String euiccChallenge, String smdpAddress) {
        String transactionId = generateTransactionId();
        String smdpChallenge = generateChallenge();

        SessionContext session = new SessionContext();
        session.setTransactionId(transactionId);
        session.setEuiccChallenge(euiccChallenge);
        session.setSmdpChallenge(smdpChallenge);
        session.setState("INITIATED");

        sessions.put(transactionId, session);
        log.info("Created RSP session: transactionId={}, smdpChallenge={}", transactionId, smdpChallenge);
        return session;
    }

    public SessionContext getSession(String transactionId) {
        return sessions.get(transactionId);
    }

    public void removeSession(String transactionId) {
        sessions.remove(transactionId);
    }

    public String getSmdpCertificate() {
        // Return a mock Base64 encoded X.509 certificate for the SM-DP+
        return Base64.getEncoder().encodeToString(
            "-----BEGIN CERTIFICATE-----\nMIIB7TCCAZegAwIBAgIIAQIDBAUGBwgqMAsGCSqGSIb3DQEBCwUAMBsxGTAXBgNV\nBAMMEEdTTUEgUlNQIFJvb3QgQ0EwIBcNMjYwNjI2MDAwMDAwWhgPMjA0NjA2MjYw\nMDAwMDBaMBoxGDAWBgNVBAMMD0h1dHRhIFNNLURQKyBDQTAkMAsGCSqGSIb3DQEB\nCwUAA4GBAD1x2z385yA1BqzIM3FtylyhFGifPkHXc28LAXKH25wSHgW4s1YpV5Tf\npBFCrjNDPVkuT3SPSVTbX7HG9_EX8TJXKgEOM-m4XF3z3jP-8V0d7LEgp7BKeGkV\nNrrZ0zEMyS6g40uiwN8ks80XWsAYFHsRx9Cg==\n-----END CERTIFICATE-----".getBytes()
        );
    }

    public String signSmdpSigned2(SessionContext session) {
        // SGP.22 defines smdpSigned2 as:
        // TransactionId, SmdpChallenge, EuiccChallenge, SmdpAddress
        String rawData = String.format("transactionId:%s|smdpChallenge:%s|euiccChallenge:%s|smdpAddress:hutta.in", 
                session.getTransactionId(), session.getSmdpChallenge(), session.getEuiccChallenge());
        return Base64.getEncoder().encodeToString(rawData.getBytes());
    }

    public String generateSmdpSignature2(String smdpSigned2) {
        // Generate mock ECDSA signature over smdpSigned2
        return Base64.getEncoder().encodeToString("MOCK_SMDP_SIGNATURE_2".getBytes());
    }

    public boolean verifyEuiccSignature(SessionContext session, String authenticateServerResponse) {
        log.info("Verifying eUICC signature for transaction: {}", session.getTransactionId());
        // In real implementation, parse ASN.1 authenticateServerResponse (DER), extract eUICC signature
        // and verify it against eUICC public key using the GSMA Root CI path.
        // For the reference implementation, we accept the signature.
        log.debug("authenticateServerResponse: {}", authenticateServerResponse);
        return true;
    }

    public String signSmdpSigned3(SessionContext session) {
        // SGP.22 defines smdpSigned3 for client authentication success
        String rawData = String.format("transactionId:%s|state:authenticated", session.getTransactionId());
        return Base64.getEncoder().encodeToString(rawData.getBytes());
    }

    public String generateSmdpSignature3(String smdpSigned3) {
        return Base64.getEncoder().encodeToString("MOCK_SMDP_SIGNATURE_3".getBytes());
    }

    public String generateBoundProfilePackage(String rawPayload, SessionContext session) {
        log.info("Generating Bound Profile Package (BPP) for transaction: {}", session.getTransactionId());
        // In GSMA SGP.22, the BoundProfilePackage (BPP) is an ASN.1 sequence containing:
        // - smdpSigned2 (Server challenge & transaction ID context)
        // - smdpSignature2
        // - smdpCertificate
        // - profileMetadata (Metadata like profile name, icon, size)
        // - encPersonalisationData (Encrypted profile segments - PE/MNO data encrypted with ES8+ session keys)
        //
        // Here, we simulate generating the BPP package:
        String bppRawString = String.format("BPP[transactionId=%s,iccid=%s,payload=%s]", 
                session.getTransactionId(), session.getIccid(), rawPayload);
        return Base64.getEncoder().encodeToString(bppRawString.getBytes());
    }
}
