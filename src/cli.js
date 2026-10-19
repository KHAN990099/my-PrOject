#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { scanProject } from './scanner.js';

const input = process.argv[2];
if (!input || process.argv.includes('--help')) {
  console.log('Usage: docforge <project-folder> [--out <directory>]');
  process.exit(input ? 0 : 1);
}
const outIndex = process.argv.indexOf('--out');
const outputDir = outIndex >= 0 ? process.argv[outIndex + 1] : input;
if (outIndex >= 0 && !outputDir) {
  console.error('The --out option needs a directory.');
  process.exit(1);
}
try {
  const result = await scanProject(path.resolve(input));
  await fs.mkdir(path.resolve(outputDir), { recursive: true });
  await fs.writeFile(path.join(path.resolve(outputDir), 'README.md'), result.readme);
  await fs.writeFile(path.join(path.resolve(outputDir), 'PROJECT_EXPLAINER.md'), result.explainer);
  console.log(`DocForge scanned ${result.files.length} readable files.`);
  console.log(`Wrote ${path.join(outputDir, 'README.md')} and ${path.join(outputDir, 'PROJECT_EXPLAINER.md')}`);
} catch (error) {
  console.error(`DocForge error: ${error instanceof Error ? error.message : 'scan failed'}`);
  process.exit(1);
}
