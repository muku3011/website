#!/usr/bin/env bash
# ==============================================================================
# Daily PostgreSQL Database Backup Script for Hutta.in
# Runs pg_dump for all active databases, gzips, and updates status JSON.
# ==============================================================================
set -Eeuo pipefail

BACKUP_DIR="/var/backups/postgresql"
DATABASES=("smdpdb" "lpadb" "keycloakdb" "blogdb" "monitordb" "hsmdb")
STATUS_FILE="${BACKUP_DIR}/backup_status.json"
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"
chmod 750 "$BACKUP_DIR"
cd "$BACKUP_DIR"


printf "[*] Starting PostgreSQL database backup...\n"
START_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
STATUS="SUCCESS"
ERROR_MSG=""
TOTAL_SIZE=0
FILES_CREATED=()

for DB in "${DATABASES[@]}"; do
    FILE_NAME="${DB}_$(date +%Y%m%d_%H%M%S).dump"
    TARGET="${BACKUP_DIR}/${FILE_NAME}"
    
    printf " - Backing up database %s to %s...\n" "$DB" "$TARGET"
    TMP_ERR=$(mktemp)
    if pg_dump -Fc -d "$DB" -f "$TARGET" 2>"$TMP_ERR"; then
        chmod 640 "$TARGET"
        SIZE=$(stat -c%s "$TARGET")
        TOTAL_SIZE=$((TOTAL_SIZE + SIZE))
        # Keep only the basename in status JSON
        FILES_CREATED+=("$FILE_NAME")
    else
        ERR_CONTENT=$(cat "$TMP_ERR" | tr '\n' ' ' | sed 's/"/\\"/g')
        printf " [!] Error backing up database %s: %s\n" "$DB" "$ERR_CONTENT" >&2
        STATUS="FAILED"
        ERROR_MSG="Failed to dump ${DB}: ${ERR_CONTENT}"
    fi
    rm -f "$TMP_ERR"
done

# Prune backups older than retention days
find "$BACKUP_DIR" -name "*.dump" -type f -mtime +"$RETENTION_DAYS" -delete

END_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Write backup metadata status JSON
cat > "$STATUS_FILE" << EOM
{
  "status": "${STATUS}",
  "error": "${ERROR_MSG}",
  "startedAt": "${START_TIME}",
  "completedAt": "${END_TIME}",
  "totalSize": ${TOTAL_SIZE},
  "files": [
$(printf '    "%s",\n' "${FILES_CREATED[@]}" | sed '$s/,$//')
  ]
}
EOM
chmod 644 "$STATUS_FILE"

printf "[+] Database backup finalized. Status: %s. Total size: %d bytes\n" "$STATUS" "$TOTAL_SIZE"
