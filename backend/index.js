"use strict";

const http = require("http");
const config = require("./src/config");
const apiRouter = require("./src/routes/api");

const BACKEND_PORT = 3001;
const BACKEND_HOST = "127.0.0.1";

const app = require("./src/app");

// Mount the S3 API under /api/s3.
app.use("/api/s3", apiRouter);

// GET /api/health - reports whether the emulator is reachable.
app.get("/api/health", async (_req, res) => {
  const { readEmulatorCredentials } = require("./src/credentials");
  const creds = readEmulatorCredentials();
  if (!creds) {
    return res.status(503).json({
      emulator: "unreachable",
      reason: "credentials file not found",
    });
  }
  const { createS3Client } = require("./src/s3-client");
  const { ListBucketsCommand } = require("@aws-sdk/client-s3");
  try {
    const client = createS3Client();
    await client.send(new ListBucketsCommand({}));
    return res.json({
      emulator: "reachable",
      endpoint: config.EMULATOR_ENDPOINT,
    });
  } catch (err) {
    return res.status(503).json({
      emulator: "unreachable",
      reason: err.message || String(err),
    });
  }
});

const server = http.createServer(app);

server.listen(BACKEND_PORT, BACKEND_HOST, () => {
  console.log(
    `[backend] listening on http://${BACKEND_HOST}:${BACKEND_PORT} ` +
      `(emulator: ${config.EMULATOR_ENDPOINT})`
  );
});
