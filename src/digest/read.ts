import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, Night, ReadNight, RunStatus } from './types.js';

const STATUSES: RunStatus[] = ['ok', 'retry', 'fail'];

type RawLine = { at: string; job: string; status: RunStatus; owner: string | null; error: string | null };

// Parse at the edge: a line that doesn't hold the shape the log promises is null, never a throw.
function parseLine(line: string): RawLine | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const line_ = value as Record<string, unknown>;
  const { at, job, status, owner, error } = line_;
  if (typeof at !== 'string' || typeof job !== 'string') return null;
  if (typeof status !== 'string' || !STATUSES.includes(status as RunStatus)) return null;
  if (owner !== undefined && owner !== null && typeof owner !== 'string') return null;
  if (error !== undefined && error !== null && typeof error !== 'string') return null;
  return {
    at,
    job,
    status: status as RunStatus,
    owner: owner ?? null,
    error: error ?? null,
  };
}

// One row per job: runs, retries, last status, last error, first and last time. Times keep the
// offset from the log (styleguide). Rows come back sorted by job.
export const readNight: ReadNight = (runsDir, night) => {
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }

  const byJob = new Map<string, DigestRow>();
  let badLines = 0;

  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    const parsed = parseLine(line);
    if (parsed === null) {
      badLines++;
      continue;
    }
    const row = byJob.get(parsed.job);
    if (row === undefined) {
      byJob.set(parsed.job, {
        job: parsed.job,
        owner: parsed.owner,
        runs: 1,
        retries: parsed.status === 'retry' ? 1 : 0,
        lastStatus: parsed.status,
        lastError: parsed.error,
        first: parsed.at,
        last: parsed.at,
      });
      continue;
    }
    row.runs++;
    if (parsed.status === 'retry') row.retries++;
    if (parsed.owner !== null) row.owner = parsed.owner;
    if (parsed.at < row.first) row.first = parsed.at;
    if (parsed.at >= row.last) {
      row.last = parsed.at;
      row.lastStatus = parsed.status;
      row.lastError = parsed.error;
    } else if (parsed.error !== null && row.lastError === null) {
      row.lastError = parsed.error;
    }
  }

  const rows = [...byJob.values()].sort((a, b) => a.job.localeCompare(b.job));
  const result: Night = { night, rows, badLines };
  return result;
};
