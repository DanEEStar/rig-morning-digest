// Save one page as a single self-contained HTML file (plan.md § 3). A command, not a browser's
// "save as": the app renders the page the same way it serves it (ADR 0001).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { lane } from '../src/lane.js';

const night = process.argv[2];
if (night === undefined) {
  console.error('usage: save-preview <night>');
  process.exit(1);
}

const res = await createApp(loadConfig()).request(`/digest/${night}`);
if (res.status !== 200) {
  console.error(`no digest for ${night}: ${res.status}`);
  process.exit(1);
}

const html = await res.text();
mkdirSync('var/preview', { recursive: true });
const out = join('var/preview', `${night}.html`);
writeFileSync(out, html);
console.log(`${out} · ${html.length} bytes · lane ${lane().id} · marker ${lane().marker ?? 'not set'}`);
