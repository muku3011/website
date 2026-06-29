package in.hutta.ldap;

import in.hutta.ldap.controller.AutheliaUserController;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
public class AutheliaUserTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    public void testUserLifecycle() {
        // Create a user
        AutheliaUserController.UserRequest createReq = new AutheliaUserController.UserRequest();
        createReq.setDisplayname("Test User");
        createReq.setEmail("test@hutta.in");
        createReq.setGroups(List.of("users"));
        createReq.setPassword("password123");

        @SuppressWarnings("rawtypes")
        ResponseEntity<Map> createResponse = restTemplate.postForEntity(
                "/gsma/rsp/v2/authelia/users?username=testuser",
                createReq,
                Map.class
        );
        assertThat(createResponse.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        // Fetch again and verify
        ResponseEntity<AutheliaUserController.UserResponse[]> afterCreateResponse = restTemplate.getForEntity(
                "/gsma/rsp/v2/authelia/users",
                AutheliaUserController.UserResponse[].class
        );
        AutheliaUserController.UserResponse[] users = Objects.requireNonNull(afterCreateResponse.getBody());
        assertThat(users).isNotNull();
        boolean found = false;
        for (AutheliaUserController.UserResponse u : users) {
            if ("testuser".equals(u.getUsername())) {
                assertThat(u.getDisplayname()).isEqualTo("Test User");
                assertThat(u.getEmail()).isEqualTo("test@hutta.in");
                assertThat(u.getGroups()).contains("users");
                found = true;
            }
        }
        assertThat(found).isTrue();

        // Update
        AutheliaUserController.UserRequest updateReq = new AutheliaUserController.UserRequest();
        updateReq.setDisplayname("Updated Test User");
        restTemplate.put(
                "/gsma/rsp/v2/authelia/users/testuser",
                updateReq
        );

        // Fetch again
        ResponseEntity<AutheliaUserController.UserResponse[]> afterUpdateResponse = restTemplate.getForEntity(
                "/gsma/rsp/v2/authelia/users",
                AutheliaUserController.UserResponse[].class
        );
        AutheliaUserController.UserResponse[] updatedUsers = Objects.requireNonNull(afterUpdateResponse.getBody());
        assertThat(updatedUsers).isNotNull();
        found = false;
        for (AutheliaUserController.UserResponse u : updatedUsers) {
            if ("testuser".equals(u.getUsername())) {
                assertThat(u.getDisplayname()).isEqualTo("Updated Test User");
                found = true;
            }
        }
        assertThat(found).isTrue();

        // Delete
        restTemplate.delete("/gsma/rsp/v2/authelia/users/testuser");

        // Verify deleted
        ResponseEntity<AutheliaUserController.UserResponse[]> afterDeleteResponse = restTemplate.getForEntity(
                "/gsma/rsp/v2/authelia/users",
                AutheliaUserController.UserResponse[].class
        );
        AutheliaUserController.UserResponse[] finalUsers = Objects.requireNonNull(afterDeleteResponse.getBody());
        assertThat(finalUsers).isNotNull();
        for (AutheliaUserController.UserResponse u : finalUsers) {
            assertThat(u.getUsername()).isNotEqualTo("testuser");
        }
    }
}
