package in.hutta.ldap.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import in.hutta.ldap.config.LdapServerManager;
import in.hutta.ldap.model.AutheliaUser;
import in.hutta.ldap.repository.AutheliaUserRepository;
import in.hutta.ldap.util.Argon2idVerifier;
import jakarta.annotation.PostConstruct;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.util.*;

@Service
@SuppressWarnings("null")
public class AutheliaUserService {

    private static final Logger log = LoggerFactory.getLogger(AutheliaUserService.class);

    private final AutheliaUserRepository userRepository;
    private final LdapServerManager ldapServerManager;
    private final ObjectMapper yamlMapper = new ObjectMapper(new YAMLFactory());

    @Value("${ldap.bootstrap-file}")
    private String bootstrapFilePath;

    public AutheliaUserService(AutheliaUserRepository userRepository, LdapServerManager ldapServerManager) {
        this.userRepository = userRepository;
        this.ldapServerManager = ldapServerManager;
    }

    @PostConstruct
    public void bootstrapFromYaml() {
        try {
            if (userRepository.count() == 0) {
                log.info("Database user table is empty. Bootstrapping from Authelia users database: {}", bootstrapFilePath);
                File file = new File(bootstrapFilePath);
                if (file.exists()) {
                    Map<?, ?> root = yamlMapper.readValue(file, Map.class);
                    Map<?, ?> usersMap = (Map<?, ?>) root.get("users");
                    if (usersMap != null) {
                        List<AutheliaUser> entitiesToSave = new ArrayList<>();
                        for (Map.Entry<?, ?> entry : usersMap.entrySet()) {
                            String username = ((String) entry.getKey()).trim().toLowerCase();
                            Map<?, ?> fields = (Map<?, ?>) entry.getValue();
                            String displayname = (String) fields.get("displayname");
                            String email = (String) fields.get("email");
                            String password = (String) fields.get("password");
                            List<?> groupsList = (List<?>) fields.get("groups");
                            
                            Set<String> groups = new LinkedHashSet<>();
                            if (groupsList != null) {
                                for (Object g : groupsList) {
                                    groups.add(String.valueOf(g));
                                }
                            }
                            
                            // Load pre-hashed password directly
                            AutheliaUser user = new AutheliaUser(username, displayname, email, password, groups);
                            entitiesToSave.add(user);
                        }
                        userRepository.saveAll(entitiesToSave);
                        log.info("Bootstrapped {} users from YAML file.", entitiesToSave.size());
                        
                        ldapServerManager.syncAllFromDatabase();
                    }
                } else {
                    log.warn("Authelia users database file not found at {}. Skipping bootstrap.", bootstrapFilePath);
                }
            }
        } catch (IOException e) {
            log.error("Failed to bootstrap users from Authelia configuration file", e);
        }
    }

    public List<AutheliaUser> getAllUsers() {
        return userRepository.findAll();
    }

    public Optional<AutheliaUser> getUserByUsername(String username) {
        return userRepository.findById(username.trim().toLowerCase());
    }

    @Transactional
    public void createUser(String username, String displayName, String email, String password, Set<String> groups) {
        String cleanedUsername = username.trim().toLowerCase();
        if (userRepository.existsById(cleanedUsername)) {
            throw new IllegalArgumentException("User already exists");
        }
        AutheliaUser user = new AutheliaUser(cleanedUsername, displayName, email, Argon2idVerifier.hash(password), groups);
        userRepository.save(user);
        ldapServerManager.addOrUpdateUser(user);
    }

    @Transactional
    public void updateUser(String username, String displayName, String email, String password, Set<String> groups) {
        String cleanedUsername = username.trim().toLowerCase();
        AutheliaUser user = userRepository.findById(cleanedUsername)
                .orElseThrow(() -> new NoSuchElementException("User not found"));
        if (displayName != null) user.setDisplayName(displayName);
        if (email != null) user.setEmail(email);
        if (groups != null) user.setGroups(groups);
        if (password != null && !password.trim().isEmpty()) {
            user.setPasswordHash(Argon2idVerifier.hash(password));
        }
        userRepository.save(user);
        ldapServerManager.addOrUpdateUser(user);
    }

    @Transactional
    public void deleteUser(String username) {
        String cleanedUsername = username.trim().toLowerCase();
        AutheliaUser user = userRepository.findById(cleanedUsername)
                .orElseThrow(() -> new NoSuchElementException("User not found"));

        if (user.getGroups().contains("admins")) {
            long adminCount = userRepository.findAll().stream()
                    .filter(u -> u.getGroups().contains("admins"))
                    .count();
            if (adminCount <= 1) {
                throw new IllegalStateException("Cannot delete the last administrator user");
            }
        }

        userRepository.delete(user);
        ldapServerManager.deleteUser(cleanedUsername);
    }
}
