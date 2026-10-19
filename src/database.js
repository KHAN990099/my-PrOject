import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function openDatabase(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'docforge.db'));
  db.exec(`CREATE TABLE IF NOT EXISTS scans (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, created_at TEXT NOT NULL, file_count INTEGER NOT NULL, readme TEXT NOT NULL, explainer TEXT NOT NULL)`);
  return db;
}

export function saveScan(db, result) {
  const createdAt = new Date().toISOString();
  const statement = db.prepare('INSERT INTO scans (title, created_at, file_count, readme, explainer) VALUES (?, ?, ?, ?, ?)');
  const saved = statement.run(result.title, createdAt, result.files.length, result.readme, result.explainer);
  return Number(saved.lastInsertRowid);
}

export function listScans(db) {
  return db.prepare('SELECT id, title, created_at AS createdAt, file_count AS fileCount FROM scans ORDER BY id DESC').all();
}

export function getScan(db, id) {
  return db.prepare('SELECT id, title, created_at AS createdAt, file_count AS fileCount, readme, explainer FROM scans WHERE id = ?').get(id);
}
