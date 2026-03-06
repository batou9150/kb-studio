# KB-Studio

KB-Studio is a web application designed to allow non-technical users to manage a knowledge base for RAG (Retrieval-Augmented Generation) systems within AI conversational agents.

**Tagline:** Pilotez votre base de connaissances

## Features

### Knowledge Base Management
- **File Management:** Upload, update, rename, delete, and download documents (PDFs, text files, images, etc.)
- **Folder Organization:** Create, rename, delete, and navigate through a virtual folder hierarchy
- **Drag & Drop:** Upload files by dragging them into the explorer, or move files between folders
- **Duplicate Detection:** Pre-upload checks with options to overwrite or skip existing files
- **Search:** Full-text search across file names

### AI-Powered Metadata Extraction
- **Single File Analysis:** Analyze individual documents on demand
- **Batch Analysis:** Process all documents at once using the Gemini Batch API
- **Extracted Metadata:**
  - **Description** — 1-2 sentence summary of the document
  - **Value Date** — Relevant date extracted from content or filename (YYYY-MM-DD)
  - **Category** — Classification into one of 17 predefined categories (FAQ, how-to, manual, contract, etc.)
- **Manual Editing:** Review and edit AI-generated metadata at any time
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
- **AI:** Google GenAI SDK (`@google/genai`) using Gemini 3.1 Flash Lite Preview
- **Search:** Vertex AI Search (Discovery Engine) for document indexing and retrieval

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
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
| `GCS_BUCKET_NAME` | GCS bucket name(s), comma-separated for multi-bucket | — |
| `GOOGLE_CLOUD_PROJECT` | Google Cloud project ID | — |
| `GEMINI_API_KEY` | Gemini API key | — |
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
| `APP_NAME` | Custom application name | `KB-Studio` |
| `APP_LOGO` | Custom logo URL | — |

Branding (`APP_NAME`, `APP_LOGO`) is configured at runtime — no rebuild needed to change them.

## Project Structure

```
kb-studio/
├── frontend/                     # React SPA
│   └── src/
│       ├── components/           # UI components
│       │   ├── App.tsx           # Main app, state management
│       │   ├── Header.tsx        # Navigation with view tabs
│       │   ├── Sidebar.tsx       # Folder tree navigation
│       │   ├── Explorer.tsx      # File list with toolbar
│       │   ├── DetailsPanel.tsx  # File preview & metadata editing
│       │   ├── SearchPanel.tsx   # Datastore & indexing management
│       │   ├── AnswerPanel.tsx   # Search & answer query interface
│       │   └── AdminPanel.tsx    # Administration functions
│       ├── api/                  # Axios HTTP client
│       └── types/                # TypeScript interfaces
├── backend/                      # Express API server
│   └── src/
│       ├── server.ts             # Express app & route definitions
│       └── services/
│           ├── storage.ts        # Google Cloud Storage integration
│           ├── gemini.ts         # Gemini API for document analysis
│           └── search.ts         # Vertex AI Search integration
└── README.md
```

## API Reference

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
| `PUT` | `/api/files/:id` | Overwrite file content |
| `PATCH` | `/api/files/:id` | Update metadata |
| `DELETE` | `/api/files/:id` | Delete a file |
| `GET` | `/api/files/:id/download` | Get signed download URL |
| `GET` | `/api/files/:id/preview` | Get inline preview URL |
| `PUT` | `/api/files/:id/rename` | Rename a file |
| `PUT` | `/api/files/:id/move` | Move to another folder |

### Analysis (Gemini)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/files/:id/analyze` | Analyze a single file |
| `POST` | `/api/files/analyze-all` | Start batch analysis |
| `GET` | `/api/files/analyze-all/status` | Poll batch status |
| `GET` | `/api/files/analyze-all/history` | List past batches |
| `GET` | `/api/files/analyze-all/:batchName/details` | Get batch results |

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
