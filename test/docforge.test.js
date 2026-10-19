import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { scanProject } from '../src/scanner.js';
import { safeZipEntryName } from '../src/server.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runningServers = new Set();

function makeZip(entries = {}) {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(entries)) zip.addFile(name, Buffer.isBuffer(content) ? content : Buffer.from(content));
  return zip.toBuffer();
}

async function startServer(options = {}) {
  const port = 3200 + Math.floor(Math.random() * 500);
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docforge-api-data-'));
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(port), DOCFORGE_DATA_DIR: dataDir, DOCFORGE_MAX_UPLOAD_MB: String(options.maxUploadMb ?? 10) },
    stdio: 'ignore'
  });
  runningServers.add({ child, dataDir });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return { child, dataDir, baseUrl: `http://127.0.0.1:${port}` };
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Test server did not start.');
}

async function stopServer(server) {
  server.child.kill();
  await new Promise((resolve) => server.child.once('exit', resolve));
  runningServers.delete(server);
  await fs.rm(server.dataDir, { recursive: true, force: true });
}

async function upload(baseUrl, zip, filename = 'sample.zip') {
  const form = new FormData();
  form.append('project', new Blob([zip], { type: 'application/zip' }), filename);
  return fetch(`${baseUrl}/api/scan`, { method: 'POST', body: form });
}

after(async () => {
  for (const server of runningServers) await stopServer(server);
});

test('valid zip is scanned and returned', async () => {
  const server = await startServer();
  try {
    const response = await upload(server.baseUrl, makeZip({ 'src/index.js': 'export function main() {}' }));
    const body = await response.json();
    assert.equal(response.status, 201);
    assert.equal(body.scan.fileCount, 1);
    assert.match(body.scan.readme, /src\/index\.js/);
    assert.match(body.scan.explainer, /Project Explainer/);
  } finally { await stopServer(server); }
});

test('corrupt zip returns a clear JSON error', async () => {
  const server = await startServer();
  try {
    const response = await upload(server.baseUrl, Buffer.from('not a zip file'), 'broken.zip');
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(typeof body.error, 'string');
  } finally { await stopServer(server); }
});

test('oversized upload is rejected', async () => {
  const server = await startServer({ maxUploadMb: 1 });
  try {
    const response = await upload(server.baseUrl, Buffer.alloc(2 * 1024 * 1024, 65), 'large.zip');
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.match(body.error, /too large/i);
  } finally { await stopServer(server); }
});

test('path traversal attempt is rejected before extraction', () => {
  for (const entry of ['../outside.txt', '/absolute.txt', 'C:/absolute.txt', 'folder/../../outside.txt']) {
    assert.equal(safeZipEntryName(entry), null, `expected ${entry} to be rejected`);
  }
});

test('empty zip is accepted with zero readable files', async () => {
  const server = await startServer();
  try {
    const response = await upload(server.baseUrl, makeZip(), 'empty.zip');
    const body = await response.json();
    assert.equal(response.status, 201);
    assert.equal(body.scan.fileCount, 0);
  } finally { await stopServer(server); }
});

test('.env files never appear in generated output', async () => {
  const server = await startServer();
  try {
    const response = await upload(server.baseUrl, makeZip({ '.env': 'PASSWORD=super-secret-value', 'src/app.js': 'export const app = true;' }), 'secrets.zip');
    const body = await response.json();
    assert.equal(response.status, 201);
    assert.doesNotMatch(body.scan.readme, /\.env|super-secret-value|PASSWORD/);
    assert.doesNotMatch(body.scan.explainer, /\.env|super-secret-value|PASSWORD/);
  } finally { await stopServer(server); }
});

test('same input gives the same generated documents', async () => {
  const server = await startServer();
  try {
    const zip = makeZip({ 'package.json': '{"name":"stable"}', 'src/index.js': 'export const value = 42;' });
    const first = await (await upload(server.baseUrl, zip, 'stable.zip')).json();
    const second = await (await upload(server.baseUrl, zip, 'stable.zip')).json();
    assert.equal(first.scan.readme, second.scan.readme);
    assert.equal(first.scan.explainer, second.scan.explainer);
  } finally { await stopServer(server); }
});

test('scanner is deterministic and excludes ignored content', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'docforge-test-'));
  await fs.mkdir(path.join(root, 'src'));
  await fs.mkdir(path.join(root, 'node_modules'));
  await fs.writeFile(path.join(root, 'src', 'main.js'), 'export function hello() {}\n');
  await fs.writeFile(path.join(root, '.env'), 'PASSWORD=do-not-read');
  await fs.writeFile(path.join(root, 'node_modules', 'ignored.js'), 'ignored');
  const first = await scanProject(root);
  const second = await scanProject(root);
  assert.deepEqual(first, second);
  assert.deepEqual(first.files.map((file) => file.path), ['src/main.js']);
  await fs.rm(root, { recursive: true, force: true });
});

test('zip entry path validation blocks traversal', () => {
  assert.equal(safeZipEntryName('../secret.txt'), null);
  assert.equal(safeZipEntryName('/absolute.txt'), null);
  assert.equal(safeZipEntryName('C:/absolute.txt'), null);
  assert.equal(safeZipEntryName('src/app.js'), 'src/app.js');
});
