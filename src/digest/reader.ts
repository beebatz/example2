import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, JobStatus, Night, ReadNight } from './types.js';

type Line = { at: string; job: string; status: JobStatus; owner: string | null; error: string | null };

const STATUSES: readonly string[] = ['ok', 'retry', 'fail'];

// Parse at the edge: anything that is not a well-formed log line is a bad line.
function parseLine(text: string): Line | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.at !== 'string' || Number.isNaN(Date.parse(o.at))) return null;
  if (typeof o.job !== 'string' || o.job === '') return null;
  if (typeof o.status !== 'string' || !STATUSES.includes(o.status)) return null;
  return {
    at: o.at,
    job: o.job,
    status: o.status as JobStatus,
    owner: typeof o.owner === 'string' ? o.owner : null,
    error: typeof o.error === 'string' ? o.error : null,
  };
}

export const readNight: ReadNight = (runsDir, night) => {
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }

  let badLines = 0;
  const byJob = new Map<string, Line[]>();
  for (const l of text.split('\n')) {
    if (l.trim() === '') continue;
    const line = parseLine(l);
    if (!line) {
      badLines += 1;
      continue;
    }
    byJob.set(line.job, [...(byJob.get(line.job) ?? []), line]);
  }

  const rows: DigestRow[] = [...byJob.entries()]
    .map(([job, lines]) => {
      const byTime = [...lines].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
      const last = byTime[byTime.length - 1];
      return {
        job,
        owner: last.owner,
        runs: lines.length,
        retries: lines.filter((x) => x.status === 'retry').length,
        lastStatus: last.status,
        lastError: [...byTime].reverse().find((x) => x.error !== null)?.error ?? null,
        firstAt: byTime[0].at,
        lastAt: last.at,
      };
    })
    .sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));

  const result: Night = { rows, badLines };
  return result;
};
