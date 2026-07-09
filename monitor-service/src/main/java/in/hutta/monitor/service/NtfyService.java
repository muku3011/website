package in.hutta.monitor.service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class NtfyService {

  @Value("${monitor.ntfy.topic:hutta_rsp_alerts_muku3011}")
  private String topic;

  private static final HttpClient HTTP =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

  public void send(String title, String message, String priority, String tags) {
    try {
      HttpRequest req =
          HttpRequest.newBuilder()
              .uri(URI.create("https://ntfy.sh/" + topic))
              .timeout(Duration.ofSeconds(8))
              .header("Title", title)
              .header("Priority", priority)
              .header("Tags", tags)
              .POST(HttpRequest.BodyPublishers.ofString(message))
              .build();
      HttpResponse<Void> resp = HTTP.send(req, HttpResponse.BodyHandlers.discarding());
      log.info("ntfy alert sent [{}] '{}' → HTTP {}", priority, title, resp.statusCode());
    } catch (Exception e) {
      log.warn("Failed to send ntfy alert '{}': {}", title, e.getMessage());
    }
  }
}
