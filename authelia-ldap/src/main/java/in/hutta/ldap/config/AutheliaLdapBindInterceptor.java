package in.hutta.ldap.config;

import com.unboundid.ldap.listener.interceptor.InMemoryInterceptedSimpleBindResult;
import com.unboundid.ldap.listener.interceptor.InMemoryOperationInterceptor;
import com.unboundid.ldap.sdk.BindResult;
import com.unboundid.ldap.sdk.Control;
import com.unboundid.ldap.sdk.ResultCode;
import in.hutta.ldap.repository.AutheliaUserRepository;
import in.hutta.ldap.util.Argon2idVerifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class AutheliaLdapBindInterceptor extends InMemoryOperationInterceptor {

  private static final Logger log = LoggerFactory.getLogger(AutheliaLdapBindInterceptor.class);

  private final AutheliaUserRepository userRepository;
  private final String adminDn;
  private final String adminPassword;

  public AutheliaLdapBindInterceptor(
      AutheliaUserRepository userRepository, String adminDn, String adminPassword) {
    this.userRepository = userRepository;
    this.adminDn = adminDn;
    this.adminPassword = adminPassword;
  }

  @Override
  public void processSimpleBindResult(InMemoryInterceptedSimpleBindResult result) {
    String bindDn = result.getRequest().getBindDN();
    String password = result.getRequest().getPassword().stringValue();

    log.debug("Intercepting simple bind result for DN: {}", bindDn);

    // Check if binding as admin
    if (bindDn.equalsIgnoreCase(adminDn)) {
      if (password.equals(adminPassword)) {
        log.info("Admin bind successful");
        result.setResult(
            new BindResult(
                result.getMessageID(),
                ResultCode.SUCCESS,
                null,
                null,
                new String[0],
                new Control[0]));
      } else {
        log.warn("Admin bind failed: invalid password");
        result.setResult(
            new BindResult(
                result.getMessageID(),
                ResultCode.INVALID_CREDENTIALS,
                null,
                null,
                new String[0],
                new Control[0]));
      }
      return;
    }

    // Check if binding as a user
    String username = null;
    String dnLower = bindDn.toLowerCase();
    if (dnLower.startsWith("uid=") && dnLower.contains("ou=users")) {
      int start = "uid=".length();
      int end = dnLower.indexOf(",");
      if (end > start) {
        username = bindDn.substring(start, end).trim().toLowerCase();
      }
    }

    if (username == null) {
      log.warn("Bind failed: DN format not recognized: {}", bindDn);
      result.setResult(
          new BindResult(
              result.getMessageID(),
              ResultCode.INVALID_CREDENTIALS,
              null,
              null,
              new String[0],
              new Control[0]));
      return;
    }

    String finalUsername = username;
    try {
      boolean authenticated =
          userRepository
              .findById(username)
              .map(
                  user -> {
                    boolean match = Argon2idVerifier.verify(password, user.getPasswordHash());
                    if (match) {
                      log.info("User bind successful: {}", finalUsername);
                    } else {
                      log.warn("User bind failed for {}: password mismatch", finalUsername);
                    }
                    return match;
                  })
              .orElseGet(
                  () -> {
                    log.warn("User bind failed: user {} not found in database", finalUsername);
                    return false;
                  });

      if (authenticated) {
        result.setResult(
            new BindResult(
                result.getMessageID(),
                ResultCode.SUCCESS,
                null,
                null,
                new String[0],
                new Control[0]));
      } else {
        result.setResult(
            new BindResult(
                result.getMessageID(),
                ResultCode.INVALID_CREDENTIALS,
                null,
                null,
                new String[0],
                new Control[0]));
      }
    } catch (Exception e) {
      log.error("Error during simple bind authentication for user: {}", username, e);
      result.setResult(
          new BindResult(
              result.getMessageID(),
              ResultCode.OTHER,
              "Internal server error during authentication",
              null,
              new String[0],
              new Control[0]));
    }
  }
}
