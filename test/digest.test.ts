import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight', () => {
  it('reads 2026-10-28: five jobs, one bad line', () => {
    const night = readNight('runs', '2026-10-28');
    expect(night).not.toBeNull();
    expect(night?.badLines).toBe(1);
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('counts runs and retries per job, and keeps the last status', () => {
    const night = readNight('runs', '2026-10-28');
    const fixtures = night?.rows.find((r) => r.job === 'fixtures/refresh');
    expect(fixtures).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: 'upstream 503' });

    const sync = night?.rows.find((r) => r.job === 'lane/sync');
    expect(sync).toMatchObject({ runs: 8, retries: 1, lastStatus: 'ok' });

    const backup = night?.rows.find((r) => r.job === 'notes/backup');
    expect(backup).toMatchObject({ runs: 1, retries: 0, lastStatus: 'fail', lastError: 'quota exceeded' });
  });

  it('keeps a null owner as null, and keeps the offset from the log', () => {
    const night = readNight('runs', '2026-10-28');
    const render = night?.rows.find((r) => r.job === 'digest/render');
    expect(render?.owner).toBeNull();
    expect(render?.first).toBe('2026-10-29T05:41:09+01:00');
    expect(render?.last).toBe('2026-10-29T05:41:09+01:00');
  });

  it('is null when the night has no file', () => {
    expect(readNight('runs', '2026-01-01')).toBeNull();
  });

  it('renders an empty night instead of throwing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    writeFileSync(join(dir, '2026-01-02.jsonl'), '');
    const night = readNight(dir, '2026-01-02');
    expect(night?.rows).toEqual([]);
    expect(night?.badLines).toBe(0);
  });

  it('counts bad lines and still reads the good ones', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    writeFileSync(
      join(dir, '2026-01-03.jsonl'),
      '{"at":"2026-01-03T01:00:00+01:00","job":"a","status":"ok","owner":"rook"}\nnot json\n{"at":"2026-01-03T02:00:00+01:00","job":"b","status":"fail","owner":null,"error":"x"}\n',
    );
    const night = readNight(dir, '2026-01-03');
    expect(night?.rows.map((r) => r.job)).toEqual(['a', 'b']);
    expect(night?.badLines).toBe(1);
  });

  it('keeps the last error a job reported, even when a later run is clean', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    writeFileSync(
      join(dir, '2026-01-04.jsonl'),
      '{"at":"2026-01-04T01:00:00+01:00","job":"a","status":"ok","owner":"rook"}\n{"at":"2026-01-04T02:00:00+01:00","job":"a","status":"retry","owner":"rook","error":"lock held"}\n{"at":"2026-01-04T03:00:00+01:00","job":"a","status":"ok","owner":"rook"}\n',
    );
    const row = readNight(dir, '2026-01-04')?.rows[0];
    expect(row).toMatchObject({ runs: 3, retries: 1, lastStatus: 'ok', lastError: 'lock held' });
  });
});
