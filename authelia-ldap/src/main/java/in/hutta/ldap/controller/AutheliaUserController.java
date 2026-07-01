package in.hutta.ldap.controller;

import in.hutta.ldap.model.AutheliaUser;
import in.hutta.ldap.service.AutheliaUserService;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/gsma/rsp/v2/authelia/users")
@CrossOrigin
public class AutheliaUserController {

  private final AutheliaUserService userService;

  public AutheliaUserController(AutheliaUserService userService) {
    this.userService = userService;
  }

  // DTO for user list/details (excluding password)
  public static class UserResponse {
    private String username;
    private String displayname;
    private String email;
    private List<String> groups;
    private Integer inactivityTimeout;

    public UserResponse(
        String username,
        String displayname,
        String email,
        List<String> groups,
        Integer inactivityTimeout) {
      this.username = username;
      this.displayname = displayname;
      this.email = email;
      this.groups = groups;
      this.inactivityTimeout = inactivityTimeout;
    }

    public String getUsername() {
      return username;
    }

    public String getDisplayname() {
      return displayname;
    }

    public String getEmail() {
      return email;
    }

    public List<String> getGroups() {
      return groups;
    }

    public Integer getInactivityTimeout() {
      return inactivityTimeout;
    }
  }

  // DTO for creating/updating a user
  public static class UserRequest {
    private String displayname;
    private String email;
    private List<String> groups;
    private String password;
    private Integer inactivityTimeout;

    public String getDisplayname() {
      return displayname;
    }

    public void setDisplayname(String displayname) {
      this.displayname = displayname;
    }

    public String getEmail() {
      return email;
    }

    public void setEmail(String email) {
      this.email = email;
    }

    public List<String> getGroups() {
      return groups;
    }

    public void setGroups(List<String> groups) {
      this.groups = groups;
    }

    public String getPassword() {
      return password;
    }

    public void setPassword(String password) {
      this.password = password;
    }

    public Integer getInactivityTimeout() {
      return inactivityTimeout;
    }

    public void setInactivityTimeout(Integer inactivityTimeout) {
      this.inactivityTimeout = inactivityTimeout;
    }
  }

  @GetMapping
  public ResponseEntity<?> getUsers() {
    List<AutheliaUser> users = userService.getAllUsers();
    List<UserResponse> responses =
        users.stream()
            .map(
                u ->
                    new UserResponse(
                        u.getUsername(),
                        u.getDisplayName(),
                        u.getEmail(),
                        new ArrayList<>(u.getGroups()),
                        u.getInactivityTimeout()))
            .collect(Collectors.toList());
    return ResponseEntity.ok(responses);
  }

  @GetMapping("/{username}")
  public ResponseEntity<?> getUserByUsername(@PathVariable("username") String username) {
    Optional<AutheliaUser> userOpt = userService.getUserByUsername(username);
    if (userOpt.isEmpty()) {
      return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "User not found"));
    }
    AutheliaUser u = userOpt.get();
    UserResponse response =
        new UserResponse(
            u.getUsername(),
            u.getDisplayName(),
            u.getEmail(),
            new ArrayList<>(u.getGroups()),
            u.getInactivityTimeout());
    return ResponseEntity.ok(response);
  }

  @PostMapping
  public ResponseEntity<?> createUser(
      @RequestBody UserRequest request, @RequestParam("username") String username) {
    if (username == null || username.trim().isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "Username is required"));
    }
    if (request.getPassword() == null || request.getPassword().trim().isEmpty()) {
      return ResponseEntity.badRequest()
          .body(Map.of("error", "Password is required for new users"));
    }
    try {
      userService.createUser(
          username,
          request.getDisplayname(),
          request.getEmail(),
          request.getPassword(),
          request.getGroups() != null
              ? new LinkedHashSet<>(request.getGroups())
              : new LinkedHashSet<>(),
          request.getInactivityTimeout());
      return ResponseEntity.status(HttpStatus.CREATED)
          .body(Map.of("message", "User created successfully"));
    } catch (IllegalArgumentException e) {
      return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
    }
  }

  @PutMapping("/{username}")
  public ResponseEntity<?> updateUser(
      @PathVariable("username") String username, @RequestBody UserRequest request) {
    try {
      userService.updateUser(
          username,
          request.getDisplayname(),
          request.getEmail(),
          request.getPassword(),
          request.getGroups() != null ? new LinkedHashSet<>(request.getGroups()) : null,
          request.getInactivityTimeout());
      return ResponseEntity.ok(Map.of("message", "User updated successfully"));
    } catch (NoSuchElementException e) {
      return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
    }
  }

  @DeleteMapping("/{username}")
  public ResponseEntity<?> deleteUser(@PathVariable("username") String username) {
    try {
      userService.deleteUser(username);
      return ResponseEntity.ok(Map.of("message", "User deleted successfully"));
    } catch (NoSuchElementException e) {
      return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
    } catch (IllegalStateException e) {
      return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", e.getMessage()));
    }
  }
}
