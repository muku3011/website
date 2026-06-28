package in.hutta.smdp.service;

import in.hutta.smdp.model.Profile;
import in.hutta.smdp.model.SessionContext;
import in.hutta.smdp.repository.ProfileRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class ProfileService {
    private static final Logger log = LoggerFactory.getLogger(ProfileService.class);

    @Autowired
    private ProfileRepository profileRepository;

    @Autowired
    private CryptoService cryptoService;

    // ==========================================================================
    // ES2+ Operator Actions
    // ==========================================================================

    public Optional<Profile> downloadOrder(String eid, String iccid, String profileType) {
        log.info("Processing downloadOrder: EID={}, ICCID={}, ProfileType={}", eid, iccid, profileType);
        
        Optional<Profile> profileOpt;
        if (iccid != null && !iccid.trim().isEmpty()) {
            profileOpt = profileRepository.findById(iccid);
        } else {
            // Find any available profile if ICCID is not specified
            profileOpt = profileRepository.findFirstByState("AVAILABLE");
        }

        if (profileOpt.isPresent()) {
            Profile profile = profileOpt.get();
            if ("AVAILABLE".equals(profile.getState())) {
                profile.setEid(eid);
                profile.setState("ORDERED");
                profileRepository.save(profile);
                log.info("Profile reserved successfully: ICCID={}, state={}", profile.getIccid(), profile.getState());
                return Optional.of(profile);
            } else {
                log.warn("Profile is not AVAILABLE: ICCID={}, state={}", profile.getIccid(), profile.getState());
            }
        } else {
            log.warn("No AVAILABLE profile found for download order");
        }
        return Optional.empty();
    }

    public boolean confirmOrder(String iccid, String eid) {
        log.info("Confirming order: ICCID={}, EID={}", iccid, eid);
        if (iccid == null) {
            return false;
        }
        Optional<Profile> profileOpt = profileRepository.findById(iccid);
        if (profileOpt.isPresent()) {
            Profile profile = profileOpt.get();
            if ("ORDERED".equals(profile.getState()) && eid.equals(profile.getEid())) {
                log.info("Order confirmed: ICCID={}", iccid);
                return true;
            }
        }
        return false;
    }

    public boolean cancelOrder(String iccid, String eid) {
        log.info("Canceling order: ICCID={}, EID={}", iccid, eid);
        if (iccid == null) {
            return false;
        }
        Optional<Profile> profileOpt = profileRepository.findById(iccid);
        if (profileOpt.isPresent()) {
            Profile profile = profileOpt.get();
            if (eid.equals(profile.getEid()) && ("ORDERED".equals(profile.getState()) || "RELEASED".equals(profile.getState()))) {
                profile.setEid(null);
                profile.setState("AVAILABLE");
                profileRepository.save(profile);
                log.info("Order cancelled, profile set back to AVAILABLE: ICCID={}", iccid);
                return true;
            }
        }
        return false;
    }

    public boolean releaseProfile(String iccid) {
        log.info("Releasing profile: ICCID={}", iccid);
        if (iccid == null) {
            return false;
        }
        Optional<Profile> profileOpt = profileRepository.findById(iccid);
        if (profileOpt.isPresent()) {
            Profile profile = profileOpt.get();
            if ("ORDERED".equals(profile.getState())) {
                profile.setState("RELEASED");
                profileRepository.save(profile);
                log.info("Profile released for download: ICCID={}", iccid);
                return true;
            }
        }
        return false;
    }

    // ==========================================================================
    // ES9+ LPA Actions
    // ==========================================================================

    public Optional<SessionContext> initiateAuthentication(String euiccChallenge, String smdpAddress, String euiccInfo1) {
        log.info("Initiating client authentication: smdpAddress={}, euiccChallenge={}", smdpAddress, euiccChallenge);
        
        // SGP.22 says we identify if there is a profile RELEASED for an EID.
        // For testing, we find the first RELEASED profile. If none is released, we find the first ORDERED profile,
        // or any AVAILABLE profile so the handshake can be tested end-to-end without strict ES2+ ordering first.
        Optional<Profile> profileOpt = profileRepository.findFirstByState("RELEASED");
        if (profileOpt.isEmpty()) {
            profileOpt = profileRepository.findFirstByState("ORDERED");
        }
        if (profileOpt.isEmpty()) {
            profileOpt = profileRepository.findFirstByState("AVAILABLE");
        }

        if (profileOpt.isPresent()) {
            Profile profile = profileOpt.get();
            SessionContext session = cryptoService.createSession(euiccChallenge, smdpAddress);
            session.setIccid(profile.getIccid());
            session.setEid(profile.getEid());
            return Optional.of(session);
        } else {
            log.error("No profile available in the system for RSP provisioning");
        }
        return Optional.empty();
    }

    public boolean authenticateClient(String transactionId, String authenticateServerResponse) {
        log.info("Processing authenticateClient for transaction: {}", transactionId);
        SessionContext session = cryptoService.getSession(transactionId);
        if (session == null) {
            log.error("Active session not found for transaction ID: {}", transactionId);
            return false;
        }

        boolean isValid = cryptoService.verifyEuiccSignature(session, authenticateServerResponse);
        if (isValid) {
            session.setState("CLIENT_AUTHENTICATED");
            log.info("eUICC client authenticated successfully: transactionId={}", transactionId);
            return true;
        }
        return false;
    }

    public Optional<String> getBoundProfilePackage(String transactionId, String prepareDownloadResponse) {
        log.info("Processing getBoundProfilePackage for transaction: {}", transactionId);
        SessionContext session = cryptoService.getSession(transactionId);
        if (session == null || !"CLIENT_AUTHENTICATED".equals(session.getState())) {
            log.error("Session is not in CLIENT_AUTHENTICATED state for transaction: {}", transactionId);
            return Optional.empty();
        }

        String iccid = session.getIccid();
        if (iccid == null) {
            log.error("No ICCID associated with session for transaction: {}", transactionId);
            return Optional.empty();
        }
        Optional<Profile> profileOpt = profileRepository.findById(iccid);
        if (profileOpt.isPresent()) {
            Profile profile = profileOpt.get();
            String bpp = cryptoService.generateBoundProfilePackage(profile.getProfilePayload(), session);
            
            // Complete download lifecycle
            profile.setState("DOWNLOADED");
            profileRepository.save(profile);
            
            // Clean up session context
            cryptoService.removeSession(transactionId);
            
            log.info("Bound Profile Package delivered. Profile state updated to DOWNLOADED: ICCID={}", profile.getIccid());
            return Optional.of(bpp);
        }
        return Optional.empty();
    }

    public void cancelSession(String transactionId) {
        log.info("Canceling RSP session: {}", transactionId);
        SessionContext session = cryptoService.getSession(transactionId);
        if (session != null) {
            // Revert profile state from ORDERED/RELEASED if cancel happens before download completes
            String iccid = session.getIccid();
            if (iccid != null) {
                Optional<Profile> profileOpt = profileRepository.findById(iccid);
                if (profileOpt.isPresent()) {
                    Profile profile = profileOpt.get();
                    if (!"DOWNLOADED".equals(profile.getState())) {
                        profile.setState("RELEASED"); // return to released state so it can be attempted again
                        profileRepository.save(profile);
                    }
                }
            }
            cryptoService.removeSession(transactionId);
            log.info("Session cancelled and cleaned up: {}", transactionId);
        }
    }

    public boolean handleNotification(in.hutta.smdp.dto.Es9Dtos.HandleNotificationRequest request) {
        if (request == null || request.getPendingNotification() == null) {
            return false;
        }
        
        in.hutta.smdp.dto.Es9Dtos.PendingNotification notification = request.getPendingNotification();
        log.info("RSP handleNotification received: operation={}, ICCID={}", 
                notification.getProfileManagementOperation(), notification.getIccid());
                
        if ("delete".equalsIgnoreCase(notification.getProfileManagementOperation())) {
            String iccid = notification.getIccid();
            if (iccid != null) {
                Optional<Profile> profileOpt = profileRepository.findById(iccid);
                if (profileOpt.isPresent()) {
                    Profile profile = profileOpt.get();
                    profile.setState("AVAILABLE");
                    profile.setEid(null);
                    profileRepository.save(profile);
                    log.info("Profile uninstalled notification processed. ICCID={} set back to AVAILABLE", iccid);
                    return true;
                }
            }
        }
        return false;
    }
}
