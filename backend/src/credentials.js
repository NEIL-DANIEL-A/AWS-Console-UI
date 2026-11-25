"use strict";

const fs = require("fs");
const config = require("./config");

/**
 * Parse the emulator's INI-style credentials file.
 * The emulator regenerates this file on every start, so we read it fresh
 * each time to pick up new credentials without restarting the backend.
 *
 * Format:
 *   [default]
 *   aws_access_key_id = ...
 *   aws_secret_access_key = ...
 */
function readEmulatorCredentials() {
  const file = config.credentialsFile();
  if (!fs.existsSync(file)) {
    return null;
  }
  const text = fs.readFileSync(file, "utf8");
  let accessKeyId = null;
  let secretAccessKey = null;
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*aws_access_key_id\s*=\s*(.+?)\s*$/);
    if (m) accessKeyId = m[1];
    const m2 = line.match(/^\s*aws_secret_access_key\s*=\s*(.+?)\s*$/);
    if (m2) secretAccessKey = m2[1];
  }
  if (!accessKeyId || !secretAccessKey) {
    return null;
  }
  return { accessKeyId, secretAccessKey };
}

module.exports = { readEmulatorCredentials };
