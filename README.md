# AWS Emulator UI

The standalone React console for the official AWS Emulator.

## Structure

- `frontend/` contains the React, Vite, TypeScript, and Cloudscape application.
- `aws-emulator-setup/` contains the legacy single-emulator Docker scripts.

## Development

```powershell
cd frontend
npm ci
npm run dev
```

The event platform builds this UI and serves it as static files.
