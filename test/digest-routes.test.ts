import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { RigConfig } from '../src/config.js';

// runs/ is read-only, so every route test builds its own night in a temp dir.
function tempRuns(night: string, body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
  writeFileSync(join(dir, `${night}.jsonl`), body);
  return dir;
}

function appFor(runsDir: string) {
  const config: RigConfig = {
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  };
  return createApp(config);
}

const good = [
  '{"at":"2026-01-05T01:00:00+01:00","job":"lane/sync","status":"ok","owner":"rook"}',
  '{"at":"2026-01-05T02:00:00+01:00","job":"fixtures/refresh","status":"retry","owner":"rook","error":"upstream 503"}',
  '{"at":"2026-01-05T02:30:00+01:00","job":"fixtures/refresh","status":"retry","owner":"rook","error":"upstream 503"}',
  '{"at":"2026-01-05T03:00:00+01:00","job":"fixtures/refresh","status":"retry","owner":"rook","error":"upstream 503"}',
  '{"at":"2026-01-05T04:00:00+01:00","job":"notes/backup","status":"fail","owner":null,"error":"quota exceeded"}',
  '{"at":"2026-01-05T05:00:00+01:00","job":"lane/sy',
].join('\n');

describe('digest routes', () => {
  it('the page and the JSON answer 200 with the same jobs, in the same order', async () => {
    const app = appFor(tempRuns('2026-01-05', good));

    const page = await app.request('/digest/2026-01-05');
    expect(page.status).toBe(200);
    const html = await page.text();
    const onPage = [...html.matchAll(/<tr><td>([^<]+)<\/td>/g)].map((m) => m[1]);
    expect(onPage).toEqual(['fixtures/refresh', 'lane/sync', 'notes/backup']);

    const json = await app.request('/api/digest/2026-01-05');
    expect(json.status).toBe(200);
    const body = (await json.json()) as { night: string; rows: { job: string }[]; badLines: number };
    expect(body.night).toBe('2026-01-05');
    expect(body.rows.map((r) => r.job)).toEqual(onPage);
  });

  it('marks retries of 3 or more and any fail on the page', async () => {
    const app = appFor(tempRuns('2026-01-05', good));
    const html = await (await app.request('/digest/2026-01-05')).text();
    expect(html).toContain('<td class="warn">3</td>');
    expect(html).toContain('<td class="warn">fail</td>');
    expect(html).toContain('1 line did not parse');
  });

  it('404s for a night with no file, on the page and on the JSON', async () => {
    const app = appFor(tempRuns('2026-01-05', good));
    expect((await app.request('/digest/2026-01-06')).status).toBe(404);
    expect((await app.request('/api/digest/2026-01-06')).status).toBe(404);
  });

  it('renders "nothing ran" for an empty night, and an empty JSON list', async () => {
    const app = appFor(tempRuns('2026-01-07', ''));
    const html = await (await app.request('/digest/2026-01-07')).text();
    expect(html).toContain('nothing ran');
    const body = (await (await app.request('/api/digest/2026-01-07')).json()) as {
      rows: unknown[];
      badLines: number;
    };
    expect(body.rows).toEqual([]);
    expect(body.badLines).toBe(0);
  });

  it('keeps the night readable when a line does not parse', async () => {
    const app = appFor(tempRuns('2026-01-08', 'not json\n{"at":"2026-01-08T01:00:00+01:00","job":"a","status":"ok","owner":"rook"}\n'));
    expect((await app.request('/digest/2026-01-08')).status).toBe(200);
    const body = (await (await app.request('/api/digest/2026-01-08')).json()) as {
      rows: { job: string }[];
      badLines: number;
    };
    expect(body.rows.map((r) => r.job)).toEqual(['a']);
    expect(body.badLines).toBe(1);
  });

  it('renders the two nights in runs/ through the real app', async () => {
    const app = appFor('runs');
    for (const night of ['2026-10-27', '2026-10-28']) {
      expect((await app.request(`/digest/${night}`)).status).toBe(200);
      expect((await app.request(`/api/digest/${night}`)).status).toBe(200);
    }
  });
});
