# KB-Studio — Frontend

React 19 + TypeScript single-page app built with Vite. See the [main README](../README.md) for features, configuration and deployment.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server on `http://localhost:5173` |
| `npm run build` | Type check and build to `dist/` |
| `npm run lint` | Run ESLint |
| `npm run preview` | Serve the production build locally |

## Configuration

| Variable | Description | Default |
|---|---|---|
| `VITE_API_BASE_URL` | Backend API URL (build time) | `http://localhost:8080/api` |

In the Docker image the frontend is built with `VITE_API_BASE_URL=/api` and served by the backend.

## Structure

- `src/App.tsx` — routing and application state
- `src/components/` — UI components (explorer, details panel, insights, search, admin)
- `src/api/` — Axios client; adds the selected `?bucket=` to every request
- `src/i18n/` — English and French translations, one namespace per screen
