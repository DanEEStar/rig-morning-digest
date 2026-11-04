// Plan: morning digest (§1). The contract every other part of the digest builds against.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One row per job in a night's run log.
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  first: string;
  last: string;
};

// A night as read from runs/<night>.jsonl. A missing file is null; a line that doesn't parse
// is counted in badLines, never thrown.
export type Night = {
  night: string;
  rows: DigestRow[];
  badLines: number;
};

export type ReadNight = (runsDir: string, night: string) => Night | null;
