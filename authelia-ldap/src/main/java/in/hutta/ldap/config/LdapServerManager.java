package in.hutta.ldap.config;

import com.unboundid.ldap.listener.InMemoryDirectoryServer;
import com.unboundid.ldap.listener.InMemoryDirectoryServerConfig;
import com.unboundid.ldap.listener.InMemoryListenerConfig;
import com.unboundid.ldap.sdk.*;
import in.hutta.ldap.model.AutheliaUser;
import in.hutta.ldap.repository.AutheliaUserRepository;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class LdapServerManager {

  private static final Logger log = LoggerFactory.getLogger(LdapServerManager.class);

  private final AutheliaUserRepository userRepository;

  @Value("${ldap.port:10389}")
  private int ldapPort;

  @Value("${ldap.base-dn:dc=hutta,dc=in}")
  private String baseDn;

  @Value("${ldap.admin-dn:cn=admin,dc=hutta,dc=in}")
  private String adminDn;

  @Value("${ldap.admin-password:admin_password}")
  private String adminPassword;

  private InMemoryDirectoryServer directoryServer;

  public LdapServerManager(AutheliaUserRepository userRepository) {
    this.userRepository = userRepository;
  }

  @PostConstruct
  public void start() {
    try {
      log.info("Initializing embedded LDAP server on port {}...", ldapPort);
      InMemoryDirectoryServerConfig config = new InMemoryDirectoryServerConfig(baseDn);
      config.addAdditionalBindCredentials(adminDn, adminPassword);
      config.setListenerConfigs(
          InMemoryListenerConfig.createLDAPConfig("default", null, ldapPort, null));
      config.addInMemoryOperationInterceptor(
          new AutheliaLdapBindInterceptor(userRepository, adminDn, adminPassword));

      // Disable schema validation for flexibility
      config.setSchema(null);

      this.directoryServer = new InMemoryDirectoryServer(config);
      this.directoryServer.startListening();
      log.info("Embedded LDAP server started successfully on port {}.", ldapPort);

      setupSchemaNodes();
      syncAllFromDatabase();

    } catch (Exception e) {
      log.error("Failed to start embedded LDAP server", e);
      throw new RuntimeException("LDAP Server startup failed", e);
    }
  }

  @PreDestroy
  public void stop() {
    if (directoryServer != null) {
      log.info("Stopping embedded LDAP server...");
      directoryServer.shutDown(true);
      log.info("Embedded LDAP server stopped.");
    }
  }

  private void setupSchemaNodes() {
    // Base DN
    try {
      Entry baseEntry = new Entry(baseDn);
      baseEntry.addAttribute(new Attribute("objectClass", "top", "domain"));
      baseEntry.addAttribute(new Attribute("dc", "hutta"));
      directoryServer.add(baseEntry);
    } catch (Exception e) {
      log.debug("Root DN node already exists: {}", e.getMessage());
    }

    // ou=users
    try {
      Entry usersEntry = new Entry("ou=users," + baseDn);
      usersEntry.addAttribute(new Attribute("objectClass", "top", "organizationalUnit"));
      usersEntry.addAttribute(new Attribute("ou", "users"));
      directoryServer.add(usersEntry);
    } catch (Exception e) {
      log.debug("ou=users already exists: {}", e.getMessage());
    }

    // ou=groups
    try {
      Entry groupsEntry = new Entry("ou=groups," + baseDn);
      groupsEntry.addAttribute(new Attribute("objectClass", "top", "organizationalUnit"));
      groupsEntry.addAttribute(new Attribute("ou", "groups"));
      directoryServer.add(groupsEntry);
    } catch (Exception e) {
      log.debug("ou=groups already exists: {}", e.getMessage());
    }
  }

  public synchronized void syncAllFromDatabase() {
    log.info("Syncing LDAP entries from database...");
    try {
      // Search and clear users
      try {
        SearchResult results =
            directoryServer.search("ou=users," + baseDn, SearchScope.ONE, "(objectClass=*)");
        for (SearchResultEntry entry : results.getSearchEntries()) {
          directoryServer.delete(entry.getDN());
        }
      } catch (LDAPException e) {
        log.debug("Error or empty users ou: {}", e.getMessage());
      }

      // Search and clear groups
      try {
        SearchResult groupResults =
            directoryServer.search("ou=groups," + baseDn, SearchScope.ONE, "(objectClass=*)");
        for (SearchResultEntry entry : groupResults.getSearchEntries()) {
          directoryServer.delete(entry.getDN());
        }
      } catch (LDAPException e) {
        log.debug("Error or empty groups ou: {}", e.getMessage());
      }

      List<AutheliaUser> dbUsers = userRepository.findAll();
      Map<String, List<String>> groupMembers = new HashMap<>();

      for (AutheliaUser user : dbUsers) {
        String userDn = "uid=" + user.getUsername() + ",ou=users," + baseDn;
        Entry userEntry = new Entry(userDn);
        userEntry.addAttribute(
            new Attribute("objectClass", "top", "person", "organizationalPerson", "inetOrgPerson"));
        userEntry.addAttribute(new Attribute("uid", user.getUsername()));
        userEntry.addAttribute(new Attribute("cn", user.getDisplayName()));
        userEntry.addAttribute(new Attribute("sn", user.getUsername()));
        if (user.getEmail() != null && !user.getEmail().trim().isEmpty()) {
          userEntry.addAttribute(new Attribute("mail", user.getEmail()));
        }
        directoryServer.add(userEntry);

        if (user.getGroups() != null) {
          for (String group : user.getGroups()) {
            groupMembers.computeIfAbsent(group, k -> new ArrayList<>()).add(userDn);
          }
        }
      }

      // Create group entries
      for (Map.Entry<String, List<String>> entry : groupMembers.entrySet()) {
        String groupName = entry.getKey();
        List<String> members = entry.getValue();
        Entry groupEntry = new Entry("cn=" + groupName + ",ou=groups," + baseDn);
        groupEntry.addAttribute(new Attribute("objectClass", "top", "groupOfNames"));
        groupEntry.addAttribute(new Attribute("cn", groupName));
        if (!members.isEmpty()) {
          groupEntry.addAttribute(new Attribute("member", members.toArray(new String[0])));
        }
        directoryServer.add(groupEntry);
      }
      log.info("LDAP entries synced successfully. Loaded {} users.", dbUsers.size());
    } catch (Exception e) {
      log.error("Failed to sync LDAP entries from database", e);
    }
  }

  public synchronized void addOrUpdateUser(AutheliaUser user) {
    log.info("Updating LDAP entry for user: {}", user.getUsername());
    syncAllFromDatabase();
  }

  public synchronized void deleteUser(String username) {
    log.info("Deleting LDAP entry for user: {}", username);
    syncAllFromDatabase();
  }
}
