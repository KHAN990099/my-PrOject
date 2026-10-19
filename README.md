# DocForge

DocForge is an offline documentation generator for the OmniRush Frontier Buildathon 2026. It scans a project and creates a beginner-friendly `README.md` plus a `PROJECT_EXPLAINER.md` that describes the major folders and files.

## Features

- Web app and CLI use the same deterministic scanner.
- Upload a `.zip` in the browser or run `docforge ./some-folder`.
- Express REST API on one port.
- SQLite scan history stored in `data/docforge.db`.
- No AI API, internet connection, or external service at runtime.
- Skips secrets, dependencies, Git metadata, build output, binaries, and very large files.
- Defends against zip path traversal and limits upload size and file count.

## Requirements

- Node.js 22 (the project is pinned by `.nvmrc`).
- Docker, optionally.

Node 26 can remain installed. The simplest local setup is to install/use Node 22 with a version manager, open this folder, and run:

```bash
npm install
npm start
```

Then open <http://localhost:3000>. `npm install` may show an engine warning if run under Node 26; use Node 22 to run the app and tests. No global package installation is needed.

## CLI

```bash
npm install
npx docforge ./some-folder
# or choose a separate output folder
npx docforge ./some-folder --out ./generated-docs
```

The CLI writes `README.md` and `PROJECT_EXPLAINER.md` to the input folder by default.

## API

- `GET /api/health` — health check.
- `POST /api/scan` — multipart upload with field name `project` and a `.zip` file.
- `GET /api/scans` — scan history.
- `GET /api/scans/:id` — generated documents for one scan.
- `GET /api/scans/:id/readme` — download the generated README.

Example:

```bash
curl -F "project=@project.zip" http://localhost:3000/api/scan
```

## Configuration

Copy `.env.example` to `.env` if desired. The server reads environment variables supplied by the shell or process manager:

- `PORT` (default `3000`)
- `DOCFORGE_DATA_DIR` (default `./data`)
- `DOCFORGE_MAX_UPLOAD_MB` (default `10`)
- `DOCFORGE_MAX_FILES` (default `1000`)

`.env` is ignored by Git and must never contain committed secrets.

## Test and build

The one required offline test command is:

```bash
npm test
```

It uses Node's built-in test runner and checks deterministic scanning, secret exclusion, and zip traversal protection. Syntax checks are also available with `npm run lint`.

Build and run with Docker:

```bash
docker build -t docforge .
docker run --rm -p 3000:3000 -v "$(pwd)/data:/app/data" docforge
```

On Windows PowerShell, use `-v "${PWD}/data:/app/data"` for the volume path.
