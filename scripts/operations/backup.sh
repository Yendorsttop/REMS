#!/bin/sh
set -eu
: "${BACKUP_DATABASE_URL:?BACKUP_DATABASE_URL is required}"
: "${BACKUP_FILE:?BACKUP_FILE is required}"
case "$BACKUP_FILE" in /*) ;; *) echo 'BACKUP_FILE must be an absolute ephemeral path' >&2; exit 2;; esac
exec pg_dump --dbname="$BACKUP_DATABASE_URL" --format=custom --no-owner --no-acl --file="$BACKUP_FILE"
