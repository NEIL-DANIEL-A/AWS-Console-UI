import express from 'express';
import cors from 'cors';
import s3Routes from './services/s3/s3.routes.js';
import ec2Routes from './services/ec2/ec2.routes.js';
import {
  createS3Client,
  createEC2Client,
  EMULATOR_ACCOUNT,
  EMULATOR_ENDPOINT,
  EMULATOR_REGION,
} from './config/emulator.js';
import { ListBucketsCommand } from '@aws-sdk/client-s3';
import { DescribeVpcsCommand } from '@aws-sdk/client-ec2';

const app = express();
app.use(cors({ origin: 'http://127.0.0.1:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', async (_req, res) => {
  try {
    const s3 = createS3Client();
    await s3.send(new ListBucketsCommand({}));
    const ec2 = createEC2Client();
    await ec2.send(new DescribeVpcsCommand({}));
    res.json({
      status: 'ok',
      mode: 'single-user-dev',
      emulatorReachable: true,
      endpoint: EMULATOR_ENDPOINT,
      region: EMULATOR_REGION,
      account: EMULATOR_ACCOUNT,
    });
  } catch (error) {
    res.status(503).json({
      status: 'degraded',
      mode: 'single-user-dev',
      emulatorReachable: false,
      endpoint: EMULATOR_ENDPOINT,
      region: EMULATOR_REGION,
      account: EMULATOR_ACCOUNT,
      error: error?.name || 'ConnectionError',
      message: error?.message || 'Unable to reach AWS Emulator',
    });
  }
});

app.use('/api/s3', s3Routes);
app.use('/api/ec2', ec2Routes);

export default app;
