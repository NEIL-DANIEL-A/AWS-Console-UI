import fs from 'node:fs';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { S3Client } from '@aws-sdk/client-s3';
import { EC2Client } from '@aws-sdk/client-ec2';
import { NodeHttpHandler } from '@smithy/node-http-handler';

export const EMULATOR_ENDPOINT = 'https://127.0.0.1:9297';
export const EMULATOR_REGION = 'us-east-1';
export const EMULATOR_ACCOUNT = '000000000000';

const EMULATOR_DIR = path.join(os.homedir(), '.aws', 'emulator', '9297');
const CREDENTIALS_PATH = path.join(EMULATOR_DIR, 'emulator_credentials');
const CA_PATH = path.join(EMULATOR_DIR, 'ca.pem');

/**
 * Parse INI-style AWS credentials file on each call so restarted emulator
 * credentials are picked up immediately without restarting the backend.
 */
export function loadEmulatorCredentials() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(`Emulator credentials file not found at ${CREDENTIALS_PATH}`);
  }

  const raw = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
  const lines = raw.split(/\r?\n/);
  let accessKeyId = '';
  let secretAccessKey = '';
  let sessionToken = undefined;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('[')) {
      continue;
    }
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();

    if (key === 'aws_access_key_id') accessKeyId = value;
    else if (key === 'aws_secret_access_key') secretAccessKey = value;
    else if (key === 'aws_session_token') sessionToken = value;
  }

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(`Invalid credentials in ${CREDENTIALS_PATH}`);
  }

  return { accessKeyId, secretAccessKey, ...(sessionToken ? { sessionToken } : {}) };
}

/**
 * Create an HTTPS agent trusting only the emulator's self-signed CA cert.
 * Never disables TLS verification globally.
 */
export function createEmulatorHttpsAgent() {
  if (!fs.existsSync(CA_PATH)) {
    throw new Error(`Emulator CA certificate not found at ${CA_PATH}`);
  }
  const ca = fs.readFileSync(CA_PATH);
  return new https.Agent({ ca });
}

/**
 * Return the per-session S3Client if present on req, or fall back to ~/.aws/emulator
 * only when SINGLE_USER_DEV=true.
 */
export function createS3Client(req) {
  if (req?.awsClients?.s3) {
    return req.awsClients.s3;
  }
  if (process.env.SINGLE_USER_DEV !== 'true') {
    throw new Error('No active session S3 client (SINGLE_USER_DEV is not enabled)');
  }
  const credentials = loadEmulatorCredentials();
  const httpsAgent = createEmulatorHttpsAgent();

  return new S3Client({
    endpoint: EMULATOR_ENDPOINT,
    region: EMULATOR_REGION,
    forcePathStyle: true,
    credentials,
    requestHandler: new NodeHttpHandler({ httpsAgent }),
  });
}

/**
 * Return the per-session EC2Client if present on req, or fall back to ~/.aws/emulator
 * only when SINGLE_USER_DEV=true.
 */
export function createEC2Client(req) {
  if (req?.awsClients?.ec2) {
    return req.awsClients.ec2;
  }
  if (process.env.SINGLE_USER_DEV !== 'true') {
    throw new Error('No active session EC2 client (SINGLE_USER_DEV is not enabled)');
  }
  const credentials = loadEmulatorCredentials();
  const httpsAgent = createEmulatorHttpsAgent();

  return new EC2Client({
    endpoint: EMULATOR_ENDPOINT,
    region: EMULATOR_REGION,
    credentials,
    requestHandler: new NodeHttpHandler({ httpsAgent }),
  });
}
