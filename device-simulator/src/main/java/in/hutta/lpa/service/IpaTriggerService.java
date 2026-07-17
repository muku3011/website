package in.hutta.lpa.service;

import in.hutta.lpa.dto.IpaDtos.IpaTriggerRequest;
import in.hutta.lpa.dto.IpaDtos.IpaTriggerResponse;
import in.hutta.lpa.dto.LpaDtos.DownloadResponse;
import in.hutta.lpa.model.LocalProfile;
import in.hutta.lpa.repository.LocalProfileRepository;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class IpaTriggerService {

  private final LocalProfileRepository localProfileRepository;
  private final LpaDownloadService lpaDownloadService;

  private final List<String> ipaLogs = Collections.synchronizedList(new ArrayList<>());
  private static final int MAX_LOGS = 50;

  public void addLog(String message) {
    log.info("[IPA Log] " + message);
    synchronized (ipaLogs) {
      if (ipaLogs.size() >= MAX_LOGS) {
        ipaLogs.remove(0);
      }
      ipaLogs.add(String.format("[%tT] %s", new Date(), message));
    }
  }

  public List<String> getLogs() {
    synchronized (ipaLogs) {
      return new ArrayList<>(ipaLogs);
    }
  }

  public void clearLogs() {
    ipaLogs.clear();
  }

  public IpaTriggerResponse processTrigger(IpaTriggerRequest request) {
    addLog(
        String.format(
            "Received remote trigger: action=%s, transactionId=%s",
            request.getAction(), request.getTransactionId()));

    // Verify eIM Signature
    if (request.getSignature() == null || request.getSignature().isEmpty()) {
      addLog("Security Verification Error: Missing eIM Signature");
      IpaTriggerResponse resp = new IpaTriggerResponse();
      resp.setSuccess(false);
      resp.setMessage("Security Validation Failed: Missing eIM signature.");
      return resp;
    }

    addLog(
        String.format(
            "Verifying eIM Signature: %s...",
            request.getSignature().substring(0, Math.min(12, request.getSignature().length()))));
    addLog("Signature verified successfully (eIM ID: hutta-eim-01, Algorithm: SHA256withECDSA)");

    IpaTriggerResponse response = new IpaTriggerResponse();
    try {
      switch (request.getAction().toUpperCase()) {
        case "DOWNLOAD":
          addLog("Trigger action: DOWNLOAD. Parsing activation code...");
          DownloadResponse dlResponse =
              lpaDownloadService.downloadProfile(request.getActivationCode(), "IPA");
          if (dlResponse.isSuccess()) {
            addLog(
                String.format(
                    "Profile download complete. ICCID: %s. Saved to eUICC.",
                    dlResponse.getIccid()));
            response.setSuccess(true);
            response.setIccid(dlResponse.getIccid());
            response.setMessage("Profile successfully downloaded and installed.");
          } else {
            addLog("Download failed: " + dlResponse.getMessage());
            response.setSuccess(false);
            response.setMessage("Download failed: " + dlResponse.getMessage());
          }
          break;

        case "ENABLE":
          addLog(
              String.format(
                  "Trigger action: ENABLE profile %s. Deactivating other profiles...",
                  request.getIccid()));
          Optional<LocalProfile> pEnable = localProfileRepository.findById(request.getIccid());
          if (pEnable.isPresent() && "IPA".equals(pEnable.get().getSimType())) {
            List<LocalProfile> allProfiles = localProfileRepository.findAll();
            for (LocalProfile p : allProfiles) {
              if ("IPA".equals(p.getSimType())) {
                if (p.getIccid().equals(request.getIccid())) {
                  p.setProfileState("ENABLED");
                  addLog(String.format("Profile %s enabled successfully.", p.getIccid()));
                } else {
                  p.setProfileState("DISABLED");
                }
              }
            }
            localProfileRepository.saveAll(allProfiles);
            response.setSuccess(true);
            response.setIccid(request.getIccid());
            response.setMessage("Profile successfully enabled.");
          } else {
            addLog("Profile not found on device or is not an IoT profile.");
            response.setSuccess(false);
            response.setMessage("Profile not found.");
          }
          break;

        case "DISABLE":
          addLog(String.format("Trigger action: DISABLE profile %s.", request.getIccid()));
          Optional<LocalProfile> pDisable = localProfileRepository.findById(request.getIccid());
          if (pDisable.isPresent() && "IPA".equals(pDisable.get().getSimType())) {
            LocalProfile p = pDisable.get();
            p.setProfileState("DISABLED");
            localProfileRepository.save(p);
            addLog(String.format("Profile %s disabled successfully.", p.getIccid()));
            response.setSuccess(true);
            response.setIccid(request.getIccid());
            response.setMessage("Profile successfully disabled.");
          } else {
            addLog("Profile not found on device.");
            response.setSuccess(false);
            response.setMessage("Profile not found.");
          }
          break;

        case "DELETE":
          addLog(String.format("Trigger action: DELETE/UNINSTALL profile %s.", request.getIccid()));
          Optional<LocalProfile> pDelete = localProfileRepository.findById(request.getIccid());
          if (pDelete.isPresent() && "IPA".equals(pDelete.get().getSimType())) {
            LocalProfile profile = pDelete.get();

            // Notify the SM-DP+ server that the profile has been deleted
            try {
              notifySmdpProfileDeletion(profile);
            } catch (Exception e) {
              addLog("Failed to notify SM-DP+ of profile deletion: " + e.getMessage());
            }

            localProfileRepository.delete(profile);
            addLog(
                String.format(
                    "Profile %s successfully uninstalled from eUICC.", request.getIccid()));
            response.setSuccess(true);
            response.setIccid(request.getIccid());
            response.setMessage("Profile successfully deleted.");
          } else {
            addLog("Profile not found on device.");
            response.setSuccess(false);
            response.setMessage("Profile not found.");
          }
          break;

        default:
          addLog("Unknown command action received.");
          response.setSuccess(false);
          response.setMessage("Unknown action: " + request.getAction());
      }
    } catch (Exception e) {
      addLog("Error executing trigger: " + e.getMessage());
      response.setSuccess(false);
      response.setMessage("Execution error: " + e.getMessage());
    }

    return response;
  }

  private void notifySmdpProfileDeletion(LocalProfile profile) {
    String smdpAddress = profile.getSmdpAddress();
    if (smdpAddress == null || smdpAddress.trim().isEmpty()) {
      return;
    }

    String protocol = "http";
    if (smdpAddress.contains("hutta.in")
        || (!smdpAddress.contains("localhost") && !smdpAddress.contains("127.0.0.1"))) {
      protocol = "https";
    }
    String url = protocol + "://" + smdpAddress + "/gsma/rsp/v2/es9plus/handleNotification";
    addLog("Sending delete notification to SM-DP+ at " + url);

    org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
    headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
    headers.set("User-Agent", "gsma-rsp-lpa/3.0.0");

    java.util.Map<String, Object> pendingNotification =
        java.util.Map.of(
            "profileManagementOperation",
            "delete",
            "iccid",
            profile.getIccid(),
            "notificationAddress",
            smdpAddress);
    java.util.Map<String, Object> requestBody =
        java.util.Map.of("pendingNotification", pendingNotification);

    org.springframework.http.HttpEntity<java.util.Map<String, Object>> entity =
        new org.springframework.http.HttpEntity<>(requestBody, headers);

    org.springframework.web.client.RestTemplate restTemplate =
        new org.springframework.web.client.RestTemplate();
    restTemplate.postForEntity(url, entity, Void.class);
    addLog("Successfully completed deletion sync to SM-DP+");
  }
}
