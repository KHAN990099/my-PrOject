# DocForge

DocForge is an offline documentation generator for the OmniRush Frontier Buildathon 2026. Give it a project folder or a project ZIP and it creates:

1. A beginner-friendly `README.md`.
2. A `PROJECT_EXPLAINER.md` describing the major folders and readable files.

It includes both a web app and a CLI. The Express server, responsive browser UI, scanner, and SQLite scan history all run locally in one Node process. No AI API or internet connection is needed at runtime.

## What it does

- Upload a `.zip` in the web app and view or download generated documentation.
- Run the same scanner from the command line.
- Store scan history in one local SQLite file: `data/docforge.db`.
- Produce stable output for the same input.
- Skip `.env` files, secret-looking names, `node_modules`, `.git`, build output, binaries, and very large files.
- Reject unsafe ZIP paths, oversized uploads, excessive file counts, invalid IDs, and invalid uploads.

## Requirements

- Node.js **22.14.0**. The version is pinned in `.nvmrc` and the Docker image.
- Docker is optional.

Node 26 may remain installed. Use a Node version manager to select Node 22.14.0 for this project, or run locally with Node 26 knowing that npm may print an engine warning.

## Setup and run

From the project directory:

```bash
npm install
npm start
```

The server listens on `http://localhost:3000`. Open that URL in a browser. The port can be changed with `PORT`:

```bash
PORT=4000 npm start
```

On Windows PowerShell:

```powershell
$env:PORT=4000
npm start
```

No global npm packages are required. Copy `.env.example` to `.env` only when local environment values are useful; `.env` is ignored by Git.

## CLI

Scan a folder and write both documents into that folder:

```bash
npx docforge ./some-folder
```

Write the results somewhere else:

```bash
npx docforge ./some-folder --out ./generated-docs
```

The CLI writes `README.md` and `PROJECT_EXPLAINER.md` after scanning. It does not send project files anywhere.

## API

The server exposes these REST endpoints:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Return service health. |
| `POST` | `/api/scan` | Upload one ZIP as multipart field `project` and generate documentation. |
| `GET` | `/api/scans` | List scan history. |
| `GET` | `/api/scans/:id` | Return one scan and its generated documents. |
| `GET` | `/api/scans/:id/readme` | Download one generated README as Markdown. |

Example upload:

```bash
curl -F "project=@project.zip" http://localhost:3000/api/scan
```

On Windows, use `curl.exe` if PowerShell resolves `curl` to another command:

```powershell
curl.exe -F "project=@C:\path\to\project.zip" http://localhost:3000/api/scan
```

## Configuration

Available environment variables are documented in `.env.example`:

- `PORT` — server port; default `3000`.
- `DOCFORGE_DATA_DIR` — SQLite directory; default `./data`.
- `DOCFORGE_MAX_UPLOAD_MB` — ZIP upload limit; default `10`.
- `DOCFORGE_MAX_FILES` — ZIP/project file-count limit; default `1000`.

## Demo steps

1. Start DocForge with `npm start`.
2. Open `http://localhost:3000`.
3. Upload the included `sample-project.zip`, or create your own ZIP containing source files.
4. Click **Generate documentation**.
5. Review the README and Project Explainer in the two document panels.
6. Click **Download README** and select the scan from **Scan history** after refreshing.

The included sample archive is a tiny JavaScript project with `package.json`, `src/index.js`, and `README.md`.

## Test

The single offline test command is:

```bash
npm test
```

The test suite covers valid and corrupt ZIPs, oversized uploads, ZIP path traversal, empty ZIPs, secret exclusion, deterministic output, ignored folders, and ZIP path validation. Syntax checks are also available:

```bash
npm run lint
```

## Docker build and deployment

Build and run the pinned Node 22.14.0 image:

```bash
docker build -t docforge .
docker run --rm -p 3000:3000 -v "$(pwd)/data:/app/data" docforge
```

On Windows PowerShell:

```powershell
docker build -t docforge .
docker run --rm -p 3000:3000 -v "${PWD}/data:/app/data" docforge
```

The Docker build runs a SQLite in-memory smoke check using Node's built-in `node:sqlite` module before copying the application. The image exposes port `3000` and starts with `node src/server.js`.

## License

This buildathon project is provided for educational and open-source experimentation.
