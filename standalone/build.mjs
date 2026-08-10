#!/usr/bin/env node
// Regenerates standalone/file-search.html from file-search.template.html by inlining the
// PDF/Word/Excel/zip libraries (as base64) straight from the installed node_modules packages.
// Run from the repo root after `npm install`: node standalone/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const nm = join(root, 'node_modules');

function b64(path) {
  return readFileSync(path).toString('base64');
}

const replacements = {
  __JSZIP_B64__: b64(join(nm, 'jszip/dist/jszip.min.js')),
  __MAMMOTH_B64__: b64(join(nm, 'mammoth/mammoth.browser.min.js')),
  __XLSX_B64__: b64(join(nm, 'xlsx/dist/xlsx.full.min.js')),
  __TESSERACT_B64__: b64(join(nm, 'tesseract.js/dist/tesseract.min.js')),
  __PDFJS_B64__: b64(join(nm, 'pdfjs-dist/build/pdf.min.mjs')),
  __PDFJS_WORKER_B64__: b64(join(nm, 'pdfjs-dist/build/pdf.worker.min.mjs')),
};

let html = readFileSync(join(here, 'file-search.template.html'), 'utf8');
for (const [token, value] of Object.entries(replacements)) {
  if (!html.includes(token)) throw new Error(`Template is missing placeholder ${token}`);
  html = html.replace(token, value);
}

const outPath = join(here, 'file-search.html');
writeFileSync(outPath, html);
console.log(`Wrote ${outPath} (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
