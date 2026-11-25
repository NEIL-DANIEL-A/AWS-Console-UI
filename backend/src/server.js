import app from './app.js';

const PORT = Number(process.env.PORT) || 3002;
const HOST = process.env.HOST || '127.0.0.1';

const DEFAULT_PASSWORDS = new Set([
  '',
  'admin',
  'password',
  'changeme',
  '123456',
  'secret',
  'default',
  'admin123',
]);

if (process.env.NODE_ENV === 'production' && process.env.SINGLE_USER_DEV !== 'true') {
  const adminPass = (process.env.ADMIN_PASSWORD || '').trim();
  if (!adminPass || DEFAULT_PASSWORDS.has(adminPass.toLowerCase())) {
    console.error(
      '[startup] FATAL: ADMIN_PASSWORD is empty or a default value in production mode. Refusing to start.'
    );
    process.exit(1);
  }
}

app.listen(PORT, HOST, () => {
  console.log(`AWS Console backend listening at http://${HOST}:${PORT}`);
});
