package in.hutta.smdp;

import in.hutta.smdp.controller.AutheliaUserController;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
public class AutheliaUserTest {

    @Autowired
    private TestRestTemplate restTemplate;

    private static final String MOCK_FILE_PATH = "src/test/resources/users_database_mock.yml";
    private static final String BACKUP_FILE_PATH = "src/test/resources/users_database_mock.yml.bak";

    @BeforeEach
    public void backupMockFile() throws IOException {
        File original = new File(MOCK_FILE_PATH);
        File backup = new File(BACKUP_FILE_PATH);
        if (original.exists()) {
            Files.copy(original.toPath(), backup.toPath(), StandardCopyOption.REPLACE_EXISTING);
        }
    }

    @AfterEach
    public void restoreMockFile() throws IOException {
        File original = new File(MOCK_FILE_PATH);
        File backup = new File(BACKUP_FILE_PATH);
        if (backup.exists()) {
            Files.copy(backup.toPath(), original.toPath(), StandardCopyOption.REPLACE_EXISTING);
            Files.delete(backup.toPath());
        }
    }

    @Test
    public void testUserCrudOperations() {
        // 1. GET all users and verify initial mock users
        ResponseEntity<AutheliaUserController.UserResponse[]> getResponse = java.util.Objects.requireNonNull(restTemplate.getForEntity(
                "/gsma/rsp/v2/authelia/users",
                AutheliaUserController.UserResponse[].class
        ));
        assertThat(getResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        AutheliaUserController.UserResponse[] users = java.util.Objects.requireNonNull(getResponse.getBody());
        assertThat(users.length).isEqualTo(2);

        // Verify content
        AutheliaUserController.UserResponse admin = List.of(users).stream()
                .filter(u -> u.getUsername().equals("adminuser"))
                .findFirst().orElseThrow();
        assertThat(admin.getDisplayname()).isEqualTo("Admin User");
        assertThat(admin.getEmail()).isEqualTo("admin@hutta.in");
        assertThat(admin.getGroups()).contains("admins", "users");

        // 2. POST create a new user
        AutheliaUserController.UserRequest createReq = new AutheliaUserController.UserRequest();
        createReq.setDisplayname("New User");
        createReq.setEmail("newuser@hutta.in");
        createReq.setPassword("secret123");
        createReq.setGroups(List.of("users"));

        @SuppressWarnings("rawtypes")
        ResponseEntity<Map> createResponse = java.util.Objects.requireNonNull(restTemplate.postForEntity(
                "/gsma/rsp/v2/authelia/users?username=newuser",
                createReq,
                Map.class
        ));
        assertThat(createResponse.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        // Verify creation in user list
        ResponseEntity<AutheliaUserController.UserResponse[]> postCreateGet = java.util.Objects.requireNonNull(restTemplate.getForEntity(
                "/gsma/rsp/v2/authelia/users",
                AutheliaUserController.UserResponse[].class
        ));
        AutheliaUserController.UserResponse[] postCreateBody = java.util.Objects.requireNonNull(postCreateGet.getBody());
        assertThat(postCreateBody.length).isEqualTo(3);

        // 3. PUT update user details
        AutheliaUserController.UserRequest updateReq = new AutheliaUserController.UserRequest();
        updateReq.setDisplayname("Updated Display Name");
        updateReq.setGroups(List.of("admins", "users")); // Promoted to admin

        restTemplate.put(
                "/gsma/rsp/v2/authelia/users/newuser",
                updateReq
        );

        // Verify updates
        ResponseEntity<AutheliaUserController.UserResponse[]> postUpdateGet = java.util.Objects.requireNonNull(restTemplate.getForEntity(
                "/gsma/rsp/v2/authelia/users",
                AutheliaUserController.UserResponse[].class
        ));
        AutheliaUserController.UserResponse[] postUpdateBody = java.util.Objects.requireNonNull(postUpdateGet.getBody());
        AutheliaUserController.UserResponse updated = List.of(postUpdateBody).stream()
                .filter(u -> u.getUsername().equals("newuser"))
                .findFirst().orElseThrow();
        assertThat(updated.getDisplayname()).isEqualTo("Updated Display Name");
        assertThat(updated.getGroups()).contains("admins", "users");

        // 4. DELETE user
        restTemplate.delete("/gsma/rsp/v2/authelia/users/newuser");

        // Verify deleted
        ResponseEntity<AutheliaUserController.UserResponse[]> postDeleteGet = java.util.Objects.requireNonNull(restTemplate.getForEntity(
                "/gsma/rsp/v2/authelia/users",
                AutheliaUserController.UserResponse[].class
        ));
        AutheliaUserController.UserResponse[] postDeleteBody = java.util.Objects.requireNonNull(postDeleteGet.getBody());
        assertThat(postDeleteBody.length).isEqualTo(2);

        // 5. Verify cannot delete the last administrator user
        @SuppressWarnings("rawtypes")
        ResponseEntity<Map> deleteAdminResponse = java.util.Objects.requireNonNull(restTemplate.exchange(
                "/gsma/rsp/v2/authelia/users/adminuser",
                HttpMethod.DELETE,
                null,
                Map.class
        ));
        assertThat(deleteAdminResponse.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }
}
