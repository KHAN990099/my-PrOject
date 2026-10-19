import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { scanProject } from '../src/scanner.js';
import { safeZipEntryName } from '../src/server.js';

test('scan is deterministic and excludes unsafe or ignored content', async () => {
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
  assert.equal(first.readme.includes('do-not-read'), false);
  await fs.rm(root, { recursive: true, force: true });
});

test('zip entry path validation blocks traversal', () => {
  assert.equal(safeZipEntryName('../secret.txt'), null);
  assert.equal(safeZipEntryName('/absolute.txt'), null);
  assert.equal(safeZipEntryName('C:/absolute.txt'), null);
  assert.equal(safeZipEntryName('src/app.js'), 'src/app.js');
});
