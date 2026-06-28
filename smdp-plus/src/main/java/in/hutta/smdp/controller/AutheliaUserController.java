package in.hutta.smdp.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import in.hutta.smdp.util.Argon2Hasher;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.io.IOException;
import java.util.*;

@RestController
@RequestMapping("/gsma/rsp/v2/authelia/users")
@CrossOrigin
public class AutheliaUserController {

    @Value("${authelia.users-file}")
    private String usersFilePath;

    private final ObjectMapper yamlMapper = new ObjectMapper(new YAMLFactory());

    // DTO for user list/details (excluding password)
    public static class UserResponse {
        private String username;
        private String displayname;
        private String email;
        private List<String> groups;

        public UserResponse(String username, String displayname, String email, List<String> groups) {
            this.username = username;
            this.displayname = displayname;
            this.email = email;
            this.groups = groups;
        }

        public String getUsername() { return username; }
        public String getDisplayname() { return displayname; }
        public String getEmail() { return email; }
        public List<String> getGroups() { return groups; }
    }

    // DTO for creating/updating a user
    public static class UserRequest {
        private String displayname;
        private String email;
        private List<String> groups;
        private String password;

        public String getDisplayname() { return displayname; }
        public void setDisplayname(String displayname) { this.displayname = displayname; }
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        public List<String> getGroups() { return groups; }
        public void setGroups(List<String> groups) { this.groups = groups; }
        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
    }

    private AutheliaConfig loadConfig() throws IOException {
        File file = new File(usersFilePath);
        if (!file.exists()) {
            AutheliaConfig config = new AutheliaConfig();
            config.setUsers(new LinkedHashMap<>());
            return config;
        }
        AutheliaConfig config = yamlMapper.readValue(file, AutheliaConfig.class);
        if (config.getUsers() == null) {
            config.setUsers(new LinkedHashMap<>());
        }
        return config;
    }

    private void saveConfig(AutheliaConfig config) throws IOException {
        File file = new File(usersFilePath);
        File parent = file.getParentFile();
        if (parent != null && !parent.exists()) {
            parent.mkdirs();
        }
        yamlMapper.writeValue(file, config);
    }

    @GetMapping
    public ResponseEntity<?> getUsers() {
        try {
            AutheliaConfig config = loadConfig();
            List<UserResponse> responses = new ArrayList<>();
            for (Map.Entry<String, AutheliaConfig.AutheliaUser> entry : config.getUsers().entrySet()) {
                responses.add(new UserResponse(
                        entry.getKey(),
                        entry.getValue().getDisplayname(),
                        entry.getValue().getEmail(),
                        entry.getValue().getGroups()
                ));
            }
            return ResponseEntity.ok(responses);
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to read Authelia database: " + e.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<?> createUser(@RequestBody UserRequest request, @RequestParam("username") String username) {
        if (username == null || username.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Username is required"));
        }
        if (request.getPassword() == null || request.getPassword().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Password is required for new users"));
        }
        try {
            AutheliaConfig config = loadConfig();
            String cleanedUsername = username.trim().toLowerCase();
            if (config.getUsers().containsKey(cleanedUsername)) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "User already exists"));
            }

            AutheliaConfig.AutheliaUser newUser = new AutheliaConfig.AutheliaUser();
            newUser.setDisplayname(request.getDisplayname());
            newUser.setEmail(request.getEmail());
            newUser.setGroups(request.getGroups() != null ? request.getGroups() : new ArrayList<>());
            newUser.setPassword(Argon2Hasher.hash(request.getPassword()));

            config.getUsers().put(cleanedUsername, newUser);
            saveConfig(config);

            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("message", "User created successfully"));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to write Authelia database: " + e.getMessage()));
        }
    }

    @PutMapping("/{username}")
    public ResponseEntity<?> updateUser(@PathVariable("username") String username, @RequestBody UserRequest request) {
        try {
            AutheliaConfig config = loadConfig();
            String cleanedUsername = username.trim().toLowerCase();
            if (!config.getUsers().containsKey(cleanedUsername)) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "User not found"));
            }

            AutheliaConfig.AutheliaUser user = config.getUsers().get(cleanedUsername);
            if (request.getDisplayname() != null) user.setDisplayname(request.getDisplayname());
            if (request.getEmail() != null) user.setEmail(request.getEmail());
            if (request.getGroups() != null) user.setGroups(request.getGroups());
            if (request.getPassword() != null && !request.getPassword().trim().isEmpty()) {
                user.setPassword(Argon2Hasher.hash(request.getPassword()));
            }

            saveConfig(config);
            return ResponseEntity.ok(Map.of("message", "User updated successfully"));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to write Authelia database: " + e.getMessage()));
        }
    }

    @DeleteMapping("/{username}")
    public ResponseEntity<?> deleteUser(@PathVariable("username") String username) {
        try {
            AutheliaConfig config = loadConfig();
            String cleanedUsername = username.trim().toLowerCase();
            if (!config.getUsers().containsKey(cleanedUsername)) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "User not found"));
            }

            boolean isDeletedUserAdmin = config.getUsers().get(cleanedUsername).getGroups().contains("admins");
            if (isDeletedUserAdmin) {
                long adminCount = config.getUsers().values().stream()
                        .filter(u -> u.getGroups().contains("admins"))
                        .count();
                if (adminCount <= 1) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .body(Map.of("error", "Cannot delete the last administrator user"));
                }
            }

            config.getUsers().remove(cleanedUsername);
            saveConfig(config);
            return ResponseEntity.ok(Map.of("message", "User deleted successfully"));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to write Authelia database: " + e.getMessage()));
        }
    }
}
