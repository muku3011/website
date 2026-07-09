package in.hutta.monitor.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class IoMetricsService {

  private static final Path NET_DEV = Paths.get("/proc/net/dev");
  private static final Path DISK_STATS = Paths.get("/proc/diskstats");

  private static final Pattern DISK_PATTERN =
      Pattern.compile("^(mmcblk[0-9]+|sd[a-z]|nvme[0-9]+n[0-9]+)$");
  private static final Pattern NET_PATTERN = Pattern.compile("^(eth|wlan|en|wl)[0-9a-zA-Z]*$");

  private Instant lastTime = Instant.now();
  private long lastRxBytes = 0;
  private long lastTxBytes = 0;
  private long lastReadBytes = 0;
  private long lastWriteBytes = 0;

  private boolean initialized = false;

  public synchronized Map<String, Object> collect() {
    Map<String, Object> metrics = new LinkedHashMap<>();

    long currentRx = 0;
    long currentTx = 0;
    long currentReadSectors = 0;
    long currentWriteSectors = 0;

    // Parse Network
    try {
      if (Files.exists(NET_DEV)) {
        List<String> lines = Files.readAllLines(NET_DEV);
        for (String line : lines) {
          String trimmed = line.trim();
          if (trimmed.contains(":")) {
            String[] parts = trimmed.split(":", 2);
            String iface = parts[0].trim();
            if (NET_PATTERN.matcher(iface).matches()) {
              String[] stats = parts[1].trim().split("\\s+");
              if (stats.length >= 9) {
                currentRx += Long.parseLong(stats[0]); // Rx bytes
                currentTx += Long.parseLong(stats[8]); // Tx bytes
              }
            }
          }
        }
      }
    } catch (IOException e) {
      log.warn("Could not read /proc/net/dev: {}", e.getMessage());
    }

    // Parse Disk
    try {
      if (Files.exists(DISK_STATS)) {
        List<String> lines = Files.readAllLines(DISK_STATS);
        for (String line : lines) {
          String[] tokens = line.trim().split("\\s+");
          if (tokens.length >= 10) {
            String device = tokens[2];
            if (DISK_PATTERN.matcher(device).matches()) {
              currentReadSectors += Long.parseLong(tokens[5]); // sectors read
              currentWriteSectors += Long.parseLong(tokens[9]); // sectors written
            }
          }
        }
      }
    } catch (IOException e) {
      log.warn("Could not read /proc/diskstats: {}", e.getMessage());
    }

    long currentReadBytes = currentReadSectors * 512;
    long currentWriteBytes = currentWriteSectors * 512;

    Instant now = Instant.now();
    double dt = (now.toEpochMilli() - lastTime.toEpochMilli()) / 1000.0;

    double rxSpeed = 0.0;
    double txSpeed = 0.0;
    double readSpeed = 0.0;
    double writeSpeed = 0.0;

    if (initialized && dt > 0.1) {
      rxSpeed = Math.max(0.0, (currentRx - lastRxBytes) / dt);
      txSpeed = Math.max(0.0, (currentTx - lastTxBytes) / dt);
      readSpeed = Math.max(0.0, (currentReadBytes - lastReadBytes) / dt);
      writeSpeed = Math.max(0.0, (currentWriteBytes - lastWriteBytes) / dt);
    } else {
      initialized = true;
    }

    // Update state
    lastTime = now;
    lastRxBytes = currentRx;
    lastTxBytes = currentTx;
    lastReadBytes = currentReadBytes;
    lastWriteBytes = currentWriteBytes;

    metrics.put("rxBytesSec", Math.round(rxSpeed));
    metrics.put("txBytesSec", Math.round(txSpeed));
    metrics.put("readBytesSec", Math.round(readSpeed));
    metrics.put("writeBytesSec", Math.round(writeSpeed));
    metrics.put("timestamp", now.toString());

    return metrics;
  }
}
