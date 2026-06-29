package in.hutta.ldap.config;

import com.unboundid.ldap.listener.InMemoryDirectoryServer;
import com.unboundid.ldap.listener.InMemoryDirectoryServerConfig;
import com.unboundid.ldap.listener.InMemoryListenerConfig;
import com.unboundid.ldap.sdk.*;
import in.hutta.ldap.model.AutheliaUser;
import in.hutta.ldap.repository.AutheliaUserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.util.*;

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
            config.setListenerConfigs(InMemoryListenerConfig.createLDAPConfig("default", null, ldapPort, null));
            config.addInMemoryOperationInterceptor(new AutheliaLdapBindInterceptor(userRepository, adminDn, adminPassword));
            
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
            directoryServer.add(new String[]{
                "dn: " + baseDn + "\n" +
                "objectClass: top\n" +
                "objectClass: domain\n" +
                "dc: hutta\n\n"
            });
        } catch (Exception e) {
            log.debug("Root DN node already exists: {}", e.getMessage());
        }

        // ou=users
        try {
            directoryServer.add(new String[]{
                "dn: ou=users," + baseDn + "\n" +
                "objectClass: top\n" +
                "objectClass: organizationalUnit\n" +
                "ou: users\n\n"
            });
        } catch (Exception e) {
            log.debug("ou=users already exists: {}", e.getMessage());
        }

        // ou=groups
        try {
            directoryServer.add(new String[]{
                "dn: ou=groups," + baseDn + "\n" +
                "objectClass: top\n" +
                "objectClass: organizationalUnit\n" +
                "ou: groups\n\n"
            });
        } catch (Exception e) {
            log.debug("ou=groups already exists: {}", e.getMessage());
        }
    }

    public synchronized void syncAllFromDatabase() {
        log.info("Syncing LDAP entries from database...");
        try {
            // Search and clear users
            try {
                SearchResult results = directoryServer.search("ou=users," + baseDn, SearchScope.ONE, "(objectClass=*)");
                for (SearchResultEntry entry : results.getSearchEntries()) {
                    directoryServer.delete(entry.getDN());
                }
            } catch (LDAPException e) {
                log.debug("Error or empty users ou: {}", e.getMessage());
            }

            // Search and clear groups
            try {
                SearchResult groupResults = directoryServer.search("ou=groups," + baseDn, SearchScope.ONE, "(objectClass=*)");
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
                directoryServer.add(new String[]{
                    "dn: " + userDn + "\n" +
                    "objectClass: top\n" +
                    "objectClass: person\n" +
                    "objectClass: organizationalPerson\n" +
                    "objectClass: inetOrgPerson\n" +
                    "uid: " + user.getUsername() + "\n" +
                    "cn: " + user.getDisplayName() + "\n" +
                    "sn: " + user.getUsername() + "\n" +
                    "mail: " + user.getEmail() + "\n\n"
                });

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
                StringBuilder sb = new StringBuilder();
                sb.append("dn: cn=").append(groupName).append(",ou=groups,").append(baseDn).append("\n")
                  .append("objectClass: top\n")
                  .append("objectClass: groupOfNames\n")
                  .append("cn: ").append(groupName).append("\n");
                
                for (String memberDn : members) {
                    sb.append("member: ").append(memberDn).append("\n");
                }
                sb.append("\n");
                directoryServer.add(new String[]{ sb.toString() });
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
