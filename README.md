# GP Autos Mobile

This repository contains the standalone Expo + React Native client for the existing GP Autos production backend.

## API target

The app connects only to the live backend at:

https://gp-autos.onrender.com

The centralized API base URL is defined in `src/config/api.ts`.

## Local development

```bash
npm install
npm start
```

For a quick TypeScript check:

```bash
npm run typecheck
```

## Notes

- This project is independent and does not include the existing GP Autos web backend or database logic.
- The backend remains the source of truth for business logic and data.
- This mobile app is a client consuming the production API only.
