package in.hutta.smdp.controller;

import in.hutta.smdp.dto.Es9Dtos.*;
import in.hutta.smdp.model.SessionContext;
import in.hutta.smdp.service.CryptoService;
import in.hutta.smdp.service.ProfileService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

@CrossOrigin
@RestController
@RequestMapping("/gsma/rsp/v2/es9plus")
public class Es9PlusController {
    private static final Logger log = LoggerFactory.getLogger(Es9PlusController.class);

    @Autowired
    private ProfileService profileService;

    @Autowired
    private CryptoService cryptoService;

    @PostMapping("/initiateAuthentication")
    public ResponseEntity<?> initiateAuthentication(
            @RequestHeader(value = "X-Admin-Protocol", required = false) String adminProtocol,
            @RequestBody InitiateAuthenticationRequest request) {
        log.info("ES9+ initiateAuthentication, protocol={}", adminProtocol);

        Optional<SessionContext> sessionOpt = profileService.initiateAuthentication(
                request.getEuiccChallenge(), request.getSmdpAddress(), request.getEuiccInfo1());

        if (sessionOpt.isPresent()) {
            SessionContext session = sessionOpt.get();
            String smdpSigned2 = cryptoService.signSmdpSigned2(session);
            String smdpSignature2 = cryptoService.generateSmdpSignature2(smdpSigned2);
            String smdpCert = cryptoService.getSmdpCertificate();

            InitiateAuthenticationResponse response = new InitiateAuthenticationResponse();
            response.setTransactionId(session.getTransactionId());
            response.setSmdpSigned2(smdpSigned2);
            response.setSmdpSignature2(smdpSignature2);
            response.setSmdpCertificate(smdpCert);

            return ResponseEntity.ok(response);
        } else {
            return ResponseEntity.status(500).body(java.util.Map.of("error", "No profiles available", "message", "Error: No profiles available for provisioning"));
        }
    }

    @PostMapping("/authenticateClient")
    public ResponseEntity<?> authenticateClient(
            @RequestHeader(value = "X-Admin-Protocol", required = false) String adminProtocol,
            @RequestBody AuthenticateClientRequest request) {
        log.info("ES9+ authenticateClient, protocol={}", adminProtocol);

        boolean isAuthenticated = profileService.authenticateClient(
                request.getTransactionId(), request.getAuthenticateServerResponse());

        if (isAuthenticated) {
            SessionContext session = cryptoService.getSession(request.getTransactionId());
            String smdpSigned3 = cryptoService.signSmdpSigned3(session);
            String smdpSignature3 = cryptoService.generateSmdpSignature3(smdpSigned3);

            AuthenticateClientResponse response = new AuthenticateClientResponse();
            response.setTransactionId(session.getTransactionId());
            response.setSmdpSigned3(smdpSigned3);
            response.setSmdpSignature3(smdpSignature3);

            return ResponseEntity.ok(response);
        } else {
            return ResponseEntity.status(401).body(java.util.Map.of("error", "Client authentication failed", "message", "Error: Client Authentication Failed"));
        }
    }

    @PostMapping("/getBoundProfilePackage")
    public ResponseEntity<?> getBoundProfilePackage(
            @RequestHeader(value = "X-Admin-Protocol", required = false) String adminProtocol,
            @RequestBody GetBoundProfilePackageRequest request) {
        log.info("ES9+ getBoundProfilePackage, protocol={}", adminProtocol);

        Optional<String> bppOpt = profileService.getBoundProfilePackage(
                request.getTransactionId(), request.getPrepareDownloadResponse());

        if (bppOpt.isPresent()) {
            GetBoundProfilePackageResponse response = new GetBoundProfilePackageResponse();
            response.setTransactionId(request.getTransactionId());
            response.setBoundProfilePackage(bppOpt.get());
            return ResponseEntity.ok(response);
        } else {
            return ResponseEntity.status(400).body(java.util.Map.of("error", "Bound profile package generation failed", "message", "Error: Failed to generate Bound Profile Package"));
        }
    }

    @PostMapping("/cancelSession")
    public ResponseEntity<CancelSessionResponse> cancelSession(
            @RequestHeader(value = "X-Admin-Protocol", required = false) String adminProtocol,
            @RequestBody CancelSessionRequest request) {
        log.info("ES9+ cancelSession, protocol={}", adminProtocol);

        profileService.cancelSession(request.getTransactionId());

        CancelSessionResponse response = new CancelSessionResponse();
        response.setStatus("Executed-Success");
        response.setCode("1");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/handleNotification")
    public ResponseEntity<?> handleNotification(
            @RequestHeader(value = "X-Admin-Protocol", required = false) String adminProtocol,
            @RequestBody HandleNotificationRequest request) {
        log.info("ES9+ handleNotification, protocol={}", adminProtocol);

        boolean success = profileService.handleNotification(request);
        if (success) {
            return ResponseEntity.ok(java.util.Map.of("status", "Executed-Success"));
        } else {
            return ResponseEntity.badRequest().body(java.util.Map.of("status", "Failed", "message", "Error processing notification"));
        }
    }
}
