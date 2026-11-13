#!/usr/bin/env bash
# Encrypts a backup folder into one file (D157):
#   scripts/backup-encrypt.sh <folder> <output.tar.gz.enc>
# with AES-256-CBC, a key from BACKUP_PASSPHRASE via PBKDF2 (600,000
# rounds, random salt). Refuses to run without a passphrase, and checks
# the result isn't readable as a dump, so an unencrypted backup can
# never be uploaded (the repository is public: anyone can download a
# workflow's artifacts).
set -euo pipefail

folder="${1:?folder}"
out="${2:?output file}"
if [ -z "${BACKUP_PASSPHRASE:-}" ] || [ "${#BACKUP_PASSPHRASE}" -lt 20 ]; then
  echo "BACKUP_PASSPHRASE is missing or shorter than 20 characters." >&2
  exit 1
fi

tar -C "$folder" -czf - . |
  openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt \
    -pass env:BACKUP_PASSPHRASE -out "$out"

# An encrypted file starts with "Salted__" and has no readable dump in it.
if [ "$(head -c 8 "$out")" != "Salted__" ]; then
  echo "The output isn't an encrypted file." >&2
  rm -f -- "$out"
  exit 1
fi
if LC_ALL=C grep -a -q -e "PGDMP" -e "CREATE TABLE" -e "COPY public." "$out"; then
  echo "The output looks unencrypted." >&2
  rm -f -- "$out"
  exit 1
fi
echo "Encrypted: $out ($(wc -c <"$out" | tr -d ' ') bytes)"
