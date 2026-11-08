import { describe, expect, it } from 'vitest';
import { countByStatus } from '../src/digest/counts.js';
import type { DigestRow, JobStatus } from '../src/digest/types.js';

function row(job: string, lastStatus: JobStatus): DigestRow {
  return {
    job,
    owner: null,
    runs: 1,
    retries: 0,
    lastStatus,
    lastError: null,
    firstAt: '2026-10-28T02:00:00+01:00',
    lastAt: '2026-10-28T02:00:00+01:00',
  };
}

describe('countByStatus', () => {
  it('counts rows by their last status, zero when absent', () => {
    expect(countByStatus([row('a', 'ok'), row('b', 'ok'), row('c', 'fail')])).toEqual({
      ok: 2,
      retry: 0,
      fail: 1,
    });
  });

  it('is all zeros for no rows', () => {
    expect(countByStatus([])).toEqual({ ok: 0, retry: 0, fail: 0 });
  });
});
