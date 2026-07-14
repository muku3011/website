package in.hutta.hsm.client;

import com.fasterxml.jackson.databind.ObjectMapper;
import in.hutta.hsm.provider.HsmConnectionContext;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

public class HsmRestClient {
  private static final HttpClient httpClient =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
  private static final ObjectMapper objectMapper = new ObjectMapper();

  private static Map<String, Object> post(String path, Map<String, Object> body) {
    try {
      String json = objectMapper.writeValueAsString(body);
      HttpRequest request =
          HttpRequest.newBuilder()
              .uri(URI.create(HsmConnectionContext.getUrl() + path))
              .header("Content-Type", "application/json")
              .header("X-HSM-PIN", HsmConnectionContext.getPin())
              .POST(HttpRequest.BodyPublishers.ofString(json))
              .build();

      HttpResponse<String> response =
          httpClient.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() != 200) {
        throw new RuntimeException(
            "HSM operation failed with status code: "
                + response.statusCode()
                + ", body: "
                + response.body());
      }
      return objectMapper.readValue(response.body(), Map.class);
    } catch (Exception e) {
      throw new RuntimeException(
          "Failed to communicate with HSM Simulator at " + HsmConnectionContext.getUrl(), e);
    }
  }

  private static Map<String, Object> get(String path) {
    try {
      HttpRequest request =
          HttpRequest.newBuilder()
              .uri(URI.create(HsmConnectionContext.getUrl() + path))
              .header("X-HSM-PIN", HsmConnectionContext.getPin())
              .GET()
              .build();

      HttpResponse<String> response =
          httpClient.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() != 200) {
        throw new RuntimeException(
            "HSM query failed with status code: "
                + response.statusCode()
                + ", body: "
                + response.body());
      }
      return objectMapper.readValue(response.body(), Map.class);
    } catch (Exception e) {
      throw new RuntimeException(
          "Failed to communicate with HSM Simulator at " + HsmConnectionContext.getUrl(), e);
    }
  }

  public static void login(String pin) {
    Map<String, Object> req = new HashMap<>();
    req.put("pin", pin);
    post("/api/hsm/session", req);
  }

  public static Map<String, Object> getKeyMetadata(String alias) {
    return get("/api/hsm/keys/" + alias);
  }

  public static byte[] performCipherOperation(
      int opmode, String alias, byte[] iv, int tagLength, byte[] data) {
    Map<String, Object> req = new HashMap<>();
    req.put("opmode", opmode);
    req.put("alias", alias);
    req.put("iv", iv != null ? Base64.getEncoder().encodeToString(iv) : null);
    req.put("tagLength", tagLength);
    req.put("data", Base64.getEncoder().encodeToString(data));

    Map<String, Object> res = post("/api/hsm/crypto/cipher", req);
    return Base64.getDecoder().decode((String) res.get("result"));
  }

  public static byte[] performSignOperation(String alias, byte[] data) {
    Map<String, Object> req = new HashMap<>();
    req.put("alias", alias);
    req.put("data", Base64.getEncoder().encodeToString(data));

    Map<String, Object> res = post("/api/hsm/crypto/sign", req);
    return Base64.getDecoder().decode((String) res.get("signature"));
  }

  public static byte[] performECDH(String alias, byte[] peerPublicKey) {
    Map<String, Object> req = new HashMap<>();
    req.put("alias", alias);
    req.put("peerPublicKey", Base64.getEncoder().encodeToString(peerPublicKey));

    Map<String, Object> res = post("/api/hsm/crypto/ecdh", req);
    return Base64.getDecoder().decode((String) res.get("sharedSecret"));
  }

  public static void generateKey(
      String alias, String algorithm, int keySize, Map<String, Object> attributes) {
    Map<String, Object> req = new HashMap<>();
    req.put("alias", alias);
    req.put("algorithm", algorithm);
    req.put("keySize", keySize);
    req.put("attributes", attributes);
    post("/api/hsm/keys/generate", req);
  }
}
