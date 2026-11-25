"use strict";

const fs = require("fs");
const https = require("https");
const { S3Client } = require("@aws-sdk/client-s3");
const { NodeHttpHandler } = require("@aws-sdk/node-http-handler");
const config = require("./config");
const { readEmulatorCredentials } = require("./credentials");

/**
 * Build a fresh S3 client on every call.
 *
 * - Credentials are read from the emulator's credentials file each time, so a
 *   restarted emulator (which regenerates credentials) is picked up without
 *   restarting this backend.
 * - The emulator's CA certificate is used to verify TLS (verification stays
 *   enabled; we never set rejectUnauthorized: false).
 * - S3 uses path-style addressing because the emulator serves all services on
 *   one IP endpoint and does not accept bucket-name-in-hostname requests.
 */
function createS3Client() {
  const creds = readEmulatorCredentials();
  if (!creds) {
    throw new Error(
      "Emulator credentials not found. Start the emulator first: .\\start-emulator.ps1"
    );
  }

  const caPem = fs.readFileSync(config.caFile(), "utf8");
  const httpsAgent = new https.Agent({
    ca: caPem,
    // TLS verification remains enabled; we supply the emulator's CA.
  });

  return new S3Client({
    endpoint: config.EMULATOR_ENDPOINT,
    region: config.REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
    },
    requestHandler: new NodeHttpHandler({ httpsAgent }),
  });
}

module.exports = { createS3Client };
