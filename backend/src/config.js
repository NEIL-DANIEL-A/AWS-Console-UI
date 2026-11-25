const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = 9297;
const HOST = "127.0.0.1";
const EMULATOR_ENDPOINT = `https://${HOST}:${PORT}`;
const REGION = "us-east-1";
const ACCOUNT_ID = "000000000000";

const EMULATOR_DIR = path.join(os.homedir(), ".aws", "emulator", String(PORT));

function emulatorFile(name) {
  return path.join(EMULATOR_DIR, name);
}

module.exports = {
  PORT,
  HOST,
  EMULATOR_ENDPOINT,
  REGION,
  ACCOUNT_ID,
  EMULATOR_DIR,
  emulatorFile,
  credentialsFile: () => emulatorFile("emulator_credentials"),
  caFile: () => emulatorFile("ca.pem"),
  configFile: () => emulatorFile("config"),
};
