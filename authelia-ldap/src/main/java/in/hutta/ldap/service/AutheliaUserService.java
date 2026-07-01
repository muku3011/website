package in.hutta.ldap.service;

import in.hutta.ldap.config.LdapServerManager;
import in.hutta.ldap.model.AutheliaUser;
import in.hutta.ldap.repository.AutheliaUserRepository;
import in.hutta.ldap.util.Argon2idVerifier;
import jakarta.transaction.Transactional;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
@SuppressWarnings("null")
public class AutheliaUserService {

  private final AutheliaUserRepository userRepository;
  private final LdapServerManager ldapServerManager;

  public AutheliaUserService(
      AutheliaUserRepository userRepository, LdapServerManager ldapServerManager) {
    this.userRepository = userRepository;
    this.ldapServerManager = ldapServerManager;
  }

  public List<AutheliaUser> getAllUsers() {
    return userRepository.findAll();
  }

  public Optional<AutheliaUser> getUserByUsername(String username) {
    return userRepository.findById(username.trim().toLowerCase());
  }

  @Transactional
  public void createUser(
      String username,
      String displayName,
      String email,
      String password,
      Set<String> groups,
      Integer inactivityTimeout) {
    String cleanedUsername = username.trim().toLowerCase();
    if (userRepository.existsById(cleanedUsername)) {
      throw new IllegalArgumentException("User already exists");
    }
    AutheliaUser user =
        new AutheliaUser(
            cleanedUsername,
            displayName,
            email,
            Argon2idVerifier.hash(password),
            groups,
            inactivityTimeout != null ? inactivityTimeout : 15);
    userRepository.save(user);
    ldapServerManager.addOrUpdateUser(user);
  }

  @Transactional
  public void updateUser(
      String username,
      String displayName,
      String email,
      String password,
      Set<String> groups,
      Integer inactivityTimeout) {
    String cleanedUsername = username.trim().toLowerCase();
    AutheliaUser user =
        userRepository
            .findById(cleanedUsername)
            .orElseThrow(() -> new NoSuchElementException("User not found"));
    if (displayName != null) user.setDisplayName(displayName);
    if (email != null) user.setEmail(email);
    if (groups != null) user.setGroups(groups);
    if (inactivityTimeout != null) user.setInactivityTimeout(inactivityTimeout);
    if (password != null && !password.trim().isEmpty()) {
      user.setPasswordHash(Argon2idVerifier.hash(password));
    }
    userRepository.save(user);
    ldapServerManager.addOrUpdateUser(user);
  }

  @Transactional
  public void deleteUser(String username) {
    String cleanedUsername = username.trim().toLowerCase();
    AutheliaUser user =
        userRepository
            .findById(cleanedUsername)
            .orElseThrow(() -> new NoSuchElementException("User not found"));

    if (user.getGroups().contains("admins")) {
      long adminCount =
          userRepository.findAll().stream().filter(u -> u.getGroups().contains("admins")).count();
      if (adminCount <= 1) {
        throw new IllegalStateException("Cannot delete the last administrator user");
      }
    }

    userRepository.delete(user);
    ldapServerManager.deleteUser(cleanedUsername);
  }
}
