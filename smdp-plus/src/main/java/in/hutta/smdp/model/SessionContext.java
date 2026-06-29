package in.hutta.smdp.model;

import lombok.Data;

@Data
public class SessionContext {
  private String transactionId;
  private String euiccChallenge;
  private String smdpChallenge;
  private String eid;
  private String iccid;
  private String state; // INITIATED, CLIENT_AUTHENTICATED, BPP_GENERATED, CANCELLED
}
