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

  /**
   * The profile state at session creation time (e.g. AVAILABLE, ORDERED, RELEASED). Used by
   * cancelSession to restore the profile to its correct prior state instead of blindly reverting to
   * RELEASED.
   */
  private String priorProfileState;
}
