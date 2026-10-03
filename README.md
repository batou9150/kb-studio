# KB-Studio

[![Docker Pulls](https://img.shields.io/docker/pulls/batou9150/kb-studio.svg)](https://hub.docker.com/r/batou9150/kb-studio/)
[![Docker Stars](https://img.shields.io/docker/stars/batou9150/kb-studio.svg)](https://hub.docker.com/r/batou9150/kb-studio/)

KB-Studio is a web application designed to allow non-technical users to manage a knowledge base for RAG (Retrieval-Augmented Generation) systems within AI conversational agents.

**Tagline:** Pilotez votre base de connaissances

## Features

### Knowledge Base Management
- **File Management:** Upload, update, rename, delete, and download documents (PDFs, text files, images, etc.)
- **Folder Organization:** Create, rename, delete, and navigate through a virtual folder hierarchy
- **Drag & Drop:** Upload files by dragging them into the explorer, or move files between folders
- **Duplicate Detection:** Pre-upload checks with options to overwrite or skip existing files
- **Search:** Filter files by name

### AI-Powered Metadata Extraction
- **Single File Analysis:** Analyze individual documents on demand
- **Batch Analysis:** Process all documents at once using the Gemini Batch API
- **Extracted Metadata:**
  - **Description** — 1-2 sentence summary of the document
  - **Value Date** — Relevant date extracted from content or filename (YYYY-MM-DD)
  - **Category** — Classification into one of 16 predefined categories (FAQ, how-to, manual, contract, etc.)
- **Manual Editing:** Review and edit AI-generated metadata at any time
- **Language:** Descriptions are generated in the UI language (French or English)
- **Duplicate Detection:** The Insights tab flags likely duplicate documents using Gemini
- **Analysis History:** View past batch analysis results with drill-down details

### Vertex AI Search Integration
- **Datastore Management:** Create and manage Vertex AI Search datastores
- **Document Indexing:** Import documents from the knowledge base into datastores
- **Search & Answer:** Query indexed documents with optional LLM-powered answer generation
- **Multi-Region Support:** Manage datastores across global, EU, and US locations
- **Processing Options:** Digital, OCR, or Layout parsing modes with configurable chunking

### White-Label Support
- Customize the application name and logo via runtime environment variables (`APP_NAME`, `APP_LOGO`)

## Technical Architecture

- **Frontend:** React 19 (TypeScript) built with Vite, styled with vanilla CSS
- **Backend:** Node.js with Express 5 (TypeScript) serving a REST API
- **Storage:** Google Cloud Storage for documents and `kb.ndjson` metadata
- **AI:** Google GenAI SDK (`@google/genai`), Gemini 3.5 Flash Lite by default (configurable with `GEMINI_MODEL`)
- **Search:** Vertex AI Search (Discovery Engine) for document indexing and retrieval

## Prerequisites

- [Node.js](https://nodejs.org/) v22 or higher (v24 LTS recommended, used by the Docker image and CI)
- A Google Cloud Project with billing enabled
- A Google Cloud Storage bucket
- A Gemini API Key (from [Google AI Studio](https://aistudio.google.com/))
- Google Cloud authentication configured (`gcloud auth application-default login`)

## Installation & Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd kb-studio
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Edit `backend/.env`:

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `8080` |
| `GCS_BUCKET_NAME` | GCS bucket name(s), comma-separated for multi-bucket | `kb-studio-bucket` |
| `GOOGLE_CLOUD_PROJECT` | Google Cloud project ID | — |
| `GEMINI_API_KEY` | Gemini API key | — |
| `SERVICE_ACCOUNT_FILE` | Path to a service account key JSON used by all Google Cloud clients (optional, uses ADC if unset) | — |
| `GEMINI_MODEL` | Gemini model used for analysis and duplicate detection (optional) | `gemini-3.5-flash-lite` |
| `MAX_UPLOAD_SIZE_MB` | Maximum size of an uploaded file (optional) | `32` |
| `CORS_ORIGIN` | Comma-separated origins allowed to call the API cross-origin (optional, see [Security](#security)) | — |
| `IAP_AUDIENCE` | Expected audience of the IAP-signed JWT; enables request verification (optional, see [Security](#security)) | — |
| `APP_NAME` | Custom application name (optional) | `KB-Studio` |
| `APP_LOGO` | Custom logo URL (optional) | — |

```bash
npm run dev
```

### 3. Frontend

In a new terminal:

```bash
cd frontend
npm install
cp .env.example .env
```

Edit `frontend/.env`:

| Variable | Description | Default |
|---|---|---|
| `VITE_API_BASE_URL` | Backend API URL | `http://localhost:8080/api` |

```bash
npm run dev
```

The application is accessible at `http://localhost:5173`.

### 4. Docker

Build and run the application as a single container:

```bash
docker build -t kb-studio .
```

```bash
docker run -p 8080:8080 \
  -e GCS_BUCKET_NAME=my-bucket \
  -e GOOGLE_CLOUD_PROJECT=my-project \
  -e GEMINI_API_KEY=my-key \
  -e APP_NAME="My Knowledge Base" \
  -e APP_LOGO="https://example.com/logo.png" \
  kb-studio
```

The application is accessible at `http://localhost:8080`.

| Variable | Description | Default |
|---|---|---|
| `GCS_BUCKET_NAME` | GCS bucket name(s), comma-separated for multi-bucket | `kb-studio-bucket` |
| `GOOGLE_CLOUD_PROJECT` | Google Cloud project ID | — |
| `GEMINI_API_KEY` | Gemini API key | — |
| `SERVICE_ACCOUNT_FILE` | Path to a service account key JSON used by all Google Cloud clients | — |
| `GEMINI_MODEL` | Gemini model used for analysis and duplicate detection | `gemini-3.5-flash-lite` |
| `MAX_UPLOAD_SIZE_MB` | Maximum size of an uploaded file | `32` |
| `CORS_ORIGIN` | Comma-separated origins allowed to call the API cross-origin | — |
| `IAP_AUDIENCE` | Expected audience of the IAP-signed JWT; enables request verification | — |
| `APP_NAME` | Custom application name | `KB-Studio` |
| `APP_LOGO` | Custom logo URL | — |

Branding (`APP_NAME`, `APP_LOGO`) is configured at runtime — no rebuild needed to change them.

### 5. Deploy to Google Cloud Run

Deploy the image available on [Docker Hub](https://hub.docker.com/r/batou9150/kb-studio/) directly to Cloud Run:

```bash
gcloud run deploy kb-studio \
  --image docker.io/batou9150/kb-studio:latest \
  --region REGION \
  --platform managed \
  --no-allow-unauthenticated \
  --iap \
  --set-env-vars GCS_BUCKET_NAME=my-bucket \
  --set-env-vars GOOGLE_CLOUD_PROJECT=my-project \
  --set-env-vars GEMINI_API_KEY=my-key \
  --set-env-vars APP_NAME="My Knowledge Base" \
  --set-env-vars APP_LOGO="https://example.com/logo.png"
```

Replace `REGION` with your preferred region (e.g., `europe-west1`).

> **Tip:** For sensitive values like `GEMINI_API_KEY`, consider using [Secret Manager](https://cloud.google.com/run/docs/configuring/services/secrets) instead of plain environment variables.

> **Note:** Cloud Run limits HTTP/1 request bodies to 32 MiB, which is why `MAX_UPLOAD_SIZE_MB` defaults to `32`.

## Security

KB-Studio has **no user accounts of its own**: anyone who can reach the API can read, modify and delete the knowledge base (including `DELETE /api/files`, which empties a bucket). Always deploy it behind an authenticating proxy such as [Identity-Aware Proxy](https://cloud.google.com/iap/docs) (the `--iap` flag above).

- **`IAP_AUDIENCE`** — when set, every `/api` request must carry a valid IAP-signed JWT (`x-goog-iap-jwt-assertion` header) for this audience, so the API refuses traffic that bypassed IAP. For Cloud Run with IAP enabled directly on the service, the audience is `/projects/PROJECT_NUMBER/locations/REGION/services/SERVICE_NAME`; behind a load balancer, it is `/projects/PROJECT_NUMBER/global/backendServices/BACKEND_SERVICE_ID`. See [Securing your app with signed headers](https://cloud.google.com/iap/docs/signed-headers-howto).
- **CORS** — in production (`NODE_ENV=production`, set by the Docker image) cross-origin requests are refused unless `CORS_ORIGIN` lists the allowed origins. In development every origin is allowed so the Vite dev server can reach the API.

## Project Structure

```
kb-studio/
├── frontend/                     # React SPA
│   └── src/
│       ├── App.tsx               # Main app, routing & state management
│       ├── components/           # UI components
│       │   ├── Header.tsx        # Navigation with view tabs & language switch
│       │   ├── Sidebar.tsx       # Folder tree navigation
│       │   ├── Explorer.tsx      # File list with toolbar
│       │   ├── DetailsPanel.tsx  # File preview & metadata editing
│       │   ├── InsightsPanel.tsx # KB statistics & duplicate detection
│       │   ├── SearchPanel.tsx   # Datastore & indexing management
│       │   ├── AnswerPanel.tsx   # Search & answer query interface
│       │   └── AdminPanel.tsx    # Administration functions
│       ├── hooks/                # Shared React hooks
│       ├── i18n/                 # Translations (en, fr)
│       ├── api/                  # Axios HTTP client
│       └── types/                # TypeScript interfaces
├── backend/                      # Express API server
│   └── src/
│       ├── server.ts             # Express app & route definitions
│       ├── credentials.ts        # Shared Google Cloud client options
│       ├── errors.ts             # HTTP errors mapped to status codes
│       └── services/
│           ├── storage.ts        # Google Cloud Storage & kb.ndjson management
│           ├── gemini.ts         # Gemini API for document analysis
│           └── search.ts         # Vertex AI Search integration
└── README.md
```

## Development

```bash
# Backend: type check, unit tests, build
cd backend && npm run typecheck && npm test && npm run build

# Frontend: lint, type check & build
cd frontend && npm run lint && npm run build
```

The same checks run in GitHub Actions on every pull request (`.github/workflows/ci.yml`), and must pass before the Docker image is published.

## API Reference

All file, folder and analysis endpoints accept an optional `?bucket=` query parameter selecting one of the buckets listed in `GCS_BUCKET_NAME` (default: the first one). Errors are returned as `{ "error": "..." }` with a `400` (invalid input), `404` (unknown file or route), `409` (target name already exists), `413` (file too large) or `500` status.

### Folders
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/folders` | List all folders |
| `POST` | `/api/folders` | Create a folder |
| `PUT` | `/api/folders/:id` | Rename a folder |
| `DELETE` | `/api/folders/:id` | Delete a folder |

### Files
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/files` | List files (`?folderId=`, `?search=`) |
| `POST` | `/api/files` | Upload file(s) |
| `POST` | `/api/files/check-duplicates` | Check for existing files |
| `DELETE` | `/api/files` | Delete **all** files of the bucket |
| `PUT` | `/api/files/:id` | Replace file content (keeps the id; a different file name renames it) |
| `PATCH` | `/api/files/:id` | Update metadata |
| `DELETE` | `/api/files/:id` | Delete a file |
| `GET` | `/api/files/:id/download` | Get signed download URL |
| `GET` | `/api/files/:id/preview` | Get inline preview URL |
| `PUT` | `/api/files/:id/rename` | Rename a file |
| `PUT` | `/api/files/:id/move` | Move to another folder |

### Analysis (Gemini)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/files/:id/analyze` | Analyze a single file (body: `{ lang }`) |
| `POST` | `/api/files/analyze-all` | Start batch analysis (body: `{ lang }`) |
| `GET` | `/api/files/analyze-all/status` | Poll batch status; results are written to `kb.ndjson` once |
| `GET` | `/api/files/analyze-all/history` | List past batches of the bucket |
| `GET` | `/api/files/analyze-all/:batchName/details` | Get batch results |
| `POST` | `/api/files/duplicates` | Detect likely duplicates (body: `{ lang }`) |

### Vertex AI Search
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/search/datastores` | List datastores |
| `POST` | `/api/search/datastores` | Create a datastore |
| `DELETE` | `/api/search/datastores/:id` | Delete a datastore |
| `POST` | `/api/search/datastores/:id/import` | Import documents |
| `GET` | `/api/search/operations/status` | Check import progress |
| `GET` | `/api/search/datastores/:id/imports` | Import history |
| `GET` | `/api/search/datastores/:id/status` | Datastore status |
| `GET` | `/api/search/datastores/:id/documents` | List indexed documents |
| `DELETE` | `/api/search/datastores/:id/documents` | Purge all documents |
| `POST` | `/api/search/datastores/:id/search` | Search query |
| `POST` | `/api/search/datastores/:id/answer` | Answer query (LLM) |

### Config
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/config` | Get bucket name, project ID, app name, and app logo |

## License

This project is licensed under the [MIT License](LICENSE).
