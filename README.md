# KB-Studio

KB-Studio is a web application designed to allow non-technical users to manage a knowledge base that will be used for a RAG (Retrieval-Augmented Generation) system within AI conversational agents. 

**Tagline:** Pilotez votre base de connaissances

## 🚀 Features

*   **File Management:** Upload, update, delete, and download documents (PDFs, text files, images, etc.).
*   **Folder Organization:** Create, rename, delete, and navigate through a virtual folder hierarchy.
*   **AI-Powered Metadata Extraction:** Automatically analyzes uploaded files using **Google Gemini 1.5 Pro (gemini-3-pro-preview)** to:
    *   Extract a value date ("date de valeur") from the content or filename.
    *   Generate a short, concise description of the document.
*   **Metadata Editing:** Manually review and edit the AI-generated metadata if needed.
*   **Drag & Drop Interface:** Easily upload files by dragging and dropping them into the explorer view.
*   **Vertex AI Search Ready:** Maintains a `kb.ndjson` file at the root of the Cloud Storage bucket, adhering to the structure expected by Vertex AI Search for unstructured data with metadata.

## 🛠️ Technical Architecture

*   **Frontend:** React (TypeScript) built with Vite. UI styled with Vanilla CSS for a clean, modern look.
*   **Backend:** Node.js & Express (TypeScript) serving a REST API.
*   **Storage:** Google Cloud Storage (Bucket used for documents and the `kb.ndjson` metadata file).
*   **AI Integration:** Google GenAI SDK (`@google/genai`) using the `gemini-3-pro-preview` model.

## 📋 Prerequisites

Before running this project, ensure you have:

*   [Node.js](https://nodejs.org/) (v18 or higher recommended)
*   A Google Cloud Project with Billing enabled.
*   A Google Cloud Storage bucket created.
*   A Gemini API Key (available via Google AI Studio).

## ⚙️ Installation & Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd kb-studio
```

### 2. Backend Setup

Navigate to the backend directory and install dependencies:

```bash
cd backend
npm install
```

Copy the example environment file and configure your variables:

```bash
cp .env.example .env
```

Edit `backend/.env` with your specific details:
*   `PORT=8080` (Optional, defaults to 8080)
*   `GCS_BUCKET_NAME=your-cloud-storage-bucket-name`
*   `GOOGLE_CLOUD_PROJECT=your-google-cloud-project-id`
*   `GEMINI_API_KEY=your-gemini-api-key`

**Note on Google Cloud Authentication:**
Ensure that your local environment is authenticated with Google Cloud to access the storage bucket. You can do this by running `gcloud auth application-default login` or by exporting the `GOOGLE_APPLICATION_CREDENTIALS` environment variable pointing to your service account JSON key file.

Start the backend development server:

```bash
npm run dev
```

### 3. Frontend Setup

In a new terminal, navigate to the frontend directory and install dependencies:

```bash
cd frontend
npm install
```

Copy the example environment file:

```bash
cp .env.example .env
```

Ensure `frontend/.env` points to your backend API:
*   `VITE_API_BASE_URL=http://localhost:8080/api`

Start the frontend development server:

```bash
npm run dev
```

The application should now be running. The frontend is accessible at `http://localhost:5173`.

## 📂 Project Structure

*   `frontend/`: React single-page application.
    *   `src/components/`: Reusable UI components (Header, Sidebar, Explorer, DetailsPanel).
    *   `src/api/`: Axios client for communicating with the backend API.
    *   `src/types/`: TypeScript interfaces shared across the frontend.
*   `backend/`: Node.js Express server.
    *   `src/server.ts`: Main Express application and API route definitions.
    *   `src/services/storage.ts`: Google Cloud Storage integration and `kb.ndjson` management.
    *   `src/services/ai.ts`: Google Gemini integration for document analysis.

## 📄 API Endpoints

*   **Folders**
    *   `GET /api/folders`: List all folders.
    *   `POST /api/folders`: Create a new folder.
*   **Files**
    *   `GET /api/files`: List files (supports `?folderId=` and `?search=` filters).
    *   `POST /api/files`: Upload new files.
    *   `PUT /api/files/:id`: Update/overwrite a specific file.
    *   `PATCH /api/files/:id`: Update file metadata (description, value date).
    *   `DELETE /api/files/:id`: Delete a file.
    *   `GET /api/files/:id/download`: Get a signed URL to download/preview a file.
    *   `PUT /api/files/:id/move`: Move a file to another folder.
