#!/usr/bin/env bash
# Decrypts a backup made by backup-encrypt.sh (D157):
#   scripts/backup-decrypt.sh <backup.tar.gz.enc> <folder>
# with BACKUP_PASSPHRASE (the one it was made with).
set -euo pipefail

in="${1:?encrypted file}"
folder="${2:?folder}"
if [ -z "${BACKUP_PASSPHRASE:-}" ]; then
  echo "BACKUP_PASSPHRASE is missing." >&2
  exit 1
fi
mkdir -p "$folder"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 \
  -pass env:BACKUP_PASSPHRASE -in "$in" | tar -C "$folder" -xzf -
echo "Decrypted into $folder:"
ls -la "$folder"
