package in.hutta.lpa.controller;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import in.hutta.lpa.model.LocalProfile;
import in.hutta.lpa.repository.LocalProfileRepository;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@SuppressWarnings("null")
public class LpaProfileControllerTest {

  @Autowired private MockMvc mockMvc;

  @Autowired private LocalProfileRepository localProfileRepository;

  @BeforeEach
  public void setUp() {
    localProfileRepository.deleteAll();
  }

  @Test
  public void testProfileCrudFlow() throws Exception {
    // 1. Seed two profiles
    LocalProfile p1 = new LocalProfile();
    p1.setIccid("89000000000000000001");
    p1.setSmdpAddress("localhost:8092");
    p1.setProfileNickname("Work Sim");
    p1.setServiceProviderName("Operator X");
    p1.setProfileState("DISABLED");
    p1.setBoundProfilePackage("payload1");

    LocalProfile p2 = new LocalProfile();
    p2.setIccid("89000000000000000002");
    p2.setSmdpAddress("localhost:8092");
    p2.setProfileNickname("Personal Sim");
    p2.setServiceProviderName("Operator Y");
    p2.setProfileState("DISABLED");
    p2.setBoundProfilePackage("payload2");

    localProfileRepository.saveAll(List.of(p1, p2));

    // 2. GET all profiles
    mockMvc
        .perform(get("/lpa/profiles"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(2)))
        .andExpect(
            jsonPath("$[0].iccid", anyOf(is("89000000000000000001"), is("89000000000000000002"))));

    // 3. Enable profile 1
    mockMvc
        .perform(put("/lpa/profiles/89000000000000000001/enable"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.profileState", is("ENABLED")));

    // Verify profile 2 remains DISABLED and profile 1 is ENABLED in DB
    LocalProfile savedP1 = localProfileRepository.findById("89000000000000000001").orElseThrow();
    LocalProfile savedP2 = localProfileRepository.findById("89000000000000000002").orElseThrow();
    assertEquals("ENABLED", savedP1.getProfileState());
    assertEquals("DISABLED", savedP2.getProfileState());

    // 4. Update nickname of profile 1
    mockMvc
        .perform(
            put("/lpa/profiles/89000000000000000001/nickname")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"nickname\":\"Office Sim\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.profileNickname", is("Office Sim")));

    assertEquals(
        "Office Sim",
        localProfileRepository.findById("89000000000000000001").orElseThrow().getProfileNickname());

    // 5. Disable profile 1
    mockMvc
        .perform(put("/lpa/profiles/89000000000000000001/disable"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.profileState", is("DISABLED")));

    assertEquals(
        "DISABLED",
        localProfileRepository.findById("89000000000000000001").orElseThrow().getProfileState());

    // 6. Delete profile 2
    mockMvc
        .perform(delete("/lpa/profiles/89000000000000000002"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success", is(true)));

    assertFalse(localProfileRepository.existsById("89000000000000000002"));
    assertTrue(localProfileRepository.existsById("89000000000000000001"));
  }
}
