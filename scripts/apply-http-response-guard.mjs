import { readFileSync, writeFileSync } from 'node:fs';

const path = new URL('../src/server.js', import.meta.url);
let source = readFileSync(path, 'utf8');

const importAnchor = "import { db, initDb } from './db.js';\n";
const importLine = "import { sendResponse } from './http-response.js';\n";
if (!source.includes(importLine)) {
  if (!source.includes(importAnchor)) throw new Error('server import anchor not found');
  source = source.replace(importAnchor, importAnchor + importLine);
}

const oldSend = `function send(res, status, body, headers = {}) {\n  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', ...headers });\n  res.end(body);\n}`;
const newSend = `function send(res, status, body, headers = {}) {\n  return sendResponse(res, status, body, headers);\n}`;
if (source.includes(oldSend)) source = source.replace(oldSend, newSend);
else if (!source.includes(newSend)) throw new Error('send() anchor not found');

writeFileSync(path, source);
console.log('Applied safe HTTP response guard to src/server.js');
