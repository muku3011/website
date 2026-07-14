package in.hutta.monitor.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
@Slf4j
@RequiredArgsConstructor
public class PostgresStatsService {

  private final JdbcTemplate jdbcTemplate;

  public List<Map<String, Object>> collect() {
    List<Map<String, Object>> stats = new ArrayList<>();
    String sql =
        "SELECT "
            + "  d.datname, "
            + "  pg_database_size(d.datname) as size_bytes, "
            + "  (SELECT count(*) FROM pg_stat_activity a WHERE a.datname = d.datname) as active_conns, "
            + "  d.blks_read, "
            + "  d.blks_hit "
            + "FROM pg_stat_database d "
            + "WHERE d.datname IN ('smdpdb', 'lpadb', 'keycloakdb', 'blogdb', 'monitordb', 'hsmdb')";

    try {
      jdbcTemplate.query(
          sql,
          (rs, rowNum) -> {
            Map<String, Object> dbStat = new LinkedHashMap<>();
            String datname = rs.getString("datname");
            long sizeBytes = rs.getLong("size_bytes");
            int activeConns = rs.getInt("active_conns");
            long blksRead = rs.getLong("blks_read");
            long blksHit = rs.getLong("blks_hit");

            double cacheHitRatio = 100.0;
            long totalBlks = blksRead + blksHit;
            if (totalBlks > 0) {
              cacheHitRatio = (double) blksHit / totalBlks * 100.0;
            }

            dbStat.put("database", datname);
            dbStat.put("sizeBytes", sizeBytes);
            dbStat.put("activeConnections", activeConns);
            dbStat.put("cacheHitRatio", Math.round(cacheHitRatio * 100.0) / 100.0);
            stats.add(dbStat);
            return null;
          });
    } catch (Exception e) {
      log.error("Failed to query PostgreSQL stats: {}", e.getMessage(), e);
    }
    return stats;
  }
}
