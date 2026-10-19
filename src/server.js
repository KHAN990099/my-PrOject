import express from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase, saveScan, listScans, getScan } from './database.js';
import { scanProject } from './scanner.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number.parseInt(process.env.PORT || '3000', 10);
const maxUploadMb = Number.parseInt(process.env.DOCFORGE_MAX_UPLOAD_MB || '10', 10);
const maxFiles = Number.parseInt(process.env.DOCFORGE_MAX_FILES || '1000', 10);
const dataDir = path.resolve(process.env.DOCFORGE_DATA_DIR || path.join(ROOT, 'data'));
const db = openDatabase(dataDir);
const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxUploadMb * 1024 * 1024, files: 1 }, fileFilter: (_req, file, cb) => cb(null, path.extname(file.originalname).toLowerCase() === '.zip') });

app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(ROOT, 'public')));

function safeZipEntryName(name) {
  const normalized = name.replaceAll('\\', '/');
  if (!normalized || normalized.startsWith('/') || /^[a-zA-Z]:\//.test(normalized) || normalized.split('/').includes('..') || normalized.includes('\0')) return null;
  return normalized.replace(/^\.\//, '');
}

async function extractZip(buffer) {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  if (entries.length > maxFiles) throw new Error(`Zip contains too many entries; maximum is ${maxFiles}.`);
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'docforge-'));
  let files = 0;
  try {
    for (const entry of entries) {
      const safeName = safeZipEntryName(entry.entryName);
      if (!safeName) throw new Error('Zip contains an unsafe path.');
      if (entry.isDirectory) continue;
      files += 1;
      if (files > maxFiles) throw new Error(`Zip contains too many files; maximum is ${maxFiles}.`);
      const destination = path.resolve(temp, safeName);
      if (destination !== temp && !destination.startsWith(`${temp}${path.sep}`)) throw new Error('Zip contains an unsafe path.');
      await fs.mkdir(path.dirname(destination), { recursive: true });
      const data = entry.getData();
      if (data.byteLength > 512 * 1024 * 1024) continue;
      await fs.writeFile(destination, data);
    }
    return temp;
  } catch (error) {
    await fs.rm(temp, { recursive: true, force: true });
    throw error;
  }
}

function publicScan(scan) {
  return { id: scan.id, title: scan.title, createdAt: scan.createdAt, fileCount: scan.fileCount, readme: scan.readme, explainer: scan.explainer };
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'docforge' }));
app.get('/api/scans', (_req, res) => res.json({ scans: listScans(db) }));
app.get('/api/scans/:id', (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Scan id must be a positive integer.' });
  const scan = getScan(db, Number(req.params.id));
  if (!scan) return res.status(404).json({ error: 'Scan not found.' });
  return res.json({ scan: publicScan(scan) });
});
app.get('/api/scans/:id/readme', (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Scan id must be a positive integer.' });
  const scan = getScan(db, Number(req.params.id));
  if (!scan) return res.status(404).json({ error: 'Scan not found.' });
  res.type('text/markdown').attachment(`${scan.title.replace(/[^a-z0-9_-]+/gi, '-').slice(0, 60) || 'project'}-README.md`).send(scan.readme);
});

app.post('/api/scan', (req, res) => upload.single('project')(req, res, async (uploadError) => {
  if (uploadError) {
    const message = uploadError.code === 'LIMIT_FILE_SIZE' ? `Upload is too large; maximum is ${maxUploadMb} MB.` : 'Upload must be a single .zip file.';
    return res.status(400).json({ error: message });
  }
  if (!req.file) return res.status(400).json({ error: 'Attach a .zip file using the project field.' });
  let temp;
  try {
    temp = await extractZip(req.file.buffer);
    const uploadedTitle = path.basename(req.file.originalname, path.extname(req.file.originalname)).replace(/[^a-z0-9 _-]/gi, '-').trim() || 'Uploaded project';
    const result = await scanProject(temp, { maxFiles, title: uploadedTitle });
    const id = saveScan(db, result);
    return res.status(201).json({ scan: publicScan({ ...result, id, createdAt: new Date().toISOString(), fileCount: result.files.length }) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not scan this upload.';
    return res.status(400).json({ error: message });
  } finally {
    if (temp) await fs.rm(temp, { recursive: true, force: true });
  }
}));

app.use((error, _req, res, _next) => res.status(500).json({ error: 'Unexpected server error.' }));

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) app.listen(port, '0.0.0.0', () => console.log(`DocForge running at http://localhost:${port}`));

export { app, safeZipEntryName };
