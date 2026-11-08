import type { DigestRow, JobStatus } from './types.js';

export type StatusCounts = Record<JobStatus, number>;

// One row per job, so this counts jobs by their last status.
export function countByStatus(rows: readonly DigestRow[]): StatusCounts {
  const counts: StatusCounts = { ok: 0, retry: 0, fail: 0 };
  for (const row of rows) counts[row.lastStatus] += 1;
  return counts;
}
