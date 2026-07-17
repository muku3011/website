package in.hutta.monitor.service;

import java.sql.Connection;
import java.sql.DriverManager;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class DatabaseStatusService {

  @Value("${monitor.db.host:localhost}")
  private String dbHost;

  @Value("${monitor.db.port:5432}")
  private int dbPort;

  @Value("${monitor.db.smdp-password:}")
  private String smdpPassword;

  @Value("${monitor.db.lpa-password:}")
  private String lpaPassword;

  @Value("${monitor.db.blog-password:}")
  private String blogPassword;

  @Value("${monitor.db.monitor-password:}")
  private String monitorPassword;

  @Value("${monitor.db.keycloak-password:}")
  private String keycloakPassword;

  @Value("${monitor.db.eim-password:}")
  private String eimPassword;

  record DbDef(String name, String dbName, String user, String passwordField) {}

  public List<Map<String, Object>> collect() {
    List<DbDef> databases =
        List.of(
            new DbDef("smdpdb", "smdpdb", "smdp", smdpPassword),
            new DbDef("lpadb", "lpadb", "lpa", lpaPassword),
            new DbDef("blogdb", "blogdb", "blog", blogPassword),
            new DbDef("monitordb", "monitordb", "monitor", monitorPassword),
            new DbDef("keycloak", "keycloakdb", "keycloak", keycloakPassword),
            new DbDef("eimdb", "eimdb", "eim", eimPassword));

    return databases.stream().map(this::checkDatabase).toList();
  }

  private Map<String, Object> checkDatabase(DbDef db) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("name", db.name());
    String url = "jdbc:postgresql://" + dbHost + ":" + dbPort + "/" + db.dbName();
    try (Connection conn = DriverManager.getConnection(url, db.user(), db.passwordField())) {
      boolean valid = conn.isValid(2);
      result.put("connected", valid);
      result.put("error", null);
    } catch (Exception e) {
      result.put("connected", false);
      result.put("error", e.getMessage());
      log.warn("DB ping failed for {}: {}", db.name(), e.getMessage());
    }
    return result;
  }
}
