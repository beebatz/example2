import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { DigestRow } from '../src/digest/types.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

type DigestJson = { night: string; rows: DigestRow[]; badLines: number };

// Job names in the order the page's table lists them: the first cell of each body row.
function pageJobs(html: string): string[] {
  return [...html.matchAll(/<tr[^>]*>\s*<td>([^<]*)<\/td>/g)].map((m) => m[1]);
}

const jsonJobs = (data: DigestJson): string[] => data.rows.map((r) => r.job);

const SORTED_JOBS = ['digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs'];

describe('GET /digest/:night', () => {
  it('answers 200 for 2026-10-28 with the rows sorted by job', async () => {
    const res = await createApp(config).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('digest · 2026-10-28');
    expect(pageJobs(html)).toEqual(SORTED_JOBS);
  });

  it('shows fixtures/refresh with its runs and retries', async () => {
    const html = await (await createApp(config).request('/digest/2026-10-28')).text();
    const row = html.match(/<tr[^>]*>\s*<td>fixtures\/refresh<\/td>[\s\S]*?<\/tr>/)?.[0] ?? '';
    expect(row).toContain('<td>4</td>');
    expect(row).toContain('<td>3</td>');
    expect(row).toContain('upstream 503');
  });

  it('answers 404 for a night with no file', async () => {
    const res = await createApp(config).request('/digest/1999-01-01');
    const html = await res.text();
    expect(res.status).toBe(404);
    expect(html).toContain('no run log for this night');
  });

  it('answers 404 for a malformed night', async () => {
    for (const night of ['..%2Fconfig', 'not-a-night']) {
      const res = await createApp(config).request(`/digest/${night}`);
      expect(res.status, night).toBe(404);
    }
  });

  it('reports 1 bad line for 2026-10-28 and still renders the other rows', async () => {
    const html = await (await createApp(config).request('/digest/2026-10-28')).text();
    expect(html).toContain('1 bad line skipped');
    expect(pageJobs(html)).toHaveLength(5);
  });

  describe('with a temp runs dir', () => {
    let dir: string;
    let tmpConfig: typeof config;

    beforeAll(() => {
      dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
      writeFileSync(join(dir, '2026-01-01.jsonl'), '');
      writeFileSync(
        join(dir, '2026-01-02.jsonl'),
        [
          '{"at":"2026-01-02T08:00:00+01:00","job":"a/first","status":"ok","owner":"rook"}',
          'not json',
          '{"at":"2026-01-02T09:00:00+01:00","job":"b/second","status":"fail","owner":null,"error":"boom"}',
          '',
        ].join('\n'),
      );
      tmpConfig = { ...config, runsDir: dir };
    });

    afterAll(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    it('says "nothing ran" for an empty night', async () => {
      const res = await createApp(tmpConfig).request('/digest/2026-01-01');
      const html = await res.text();
      expect(res.status).toBe(200);
      expect(html).toContain('nothing ran');
      expect(html).not.toContain('<table>');
      expect(html).not.toContain('bad line');
    });

    it('renders the valid rows of a night with a bad line', async () => {
      const res = await createApp(tmpConfig).request('/digest/2026-01-02');
      const html = await res.text();
      expect(res.status).toBe(200);
      expect(html).toContain('1 bad line skipped');
      expect(pageJobs(html)).toEqual(['a/first', 'b/second']);
    });
  });
});

describe('GET /api/digest/:night', () => {
  it('answers 200 for 2026-10-28 with the rows sorted by job', async () => {
    const res = await createApp(config).request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const data = (await res.json()) as DigestJson;
    expect(data.night).toBe('2026-10-28');
    expect(jsonJobs(data)).toEqual(SORTED_JOBS);
    const fixtures = data.rows.find((r) => r.job === 'fixtures/refresh');
    expect(fixtures).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: 'upstream 503' });
  });

  it('answers 404 for a night with no file', async () => {
    const res = await createApp(config).request('/api/digest/1999-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such night' });
  });

  it('answers 404 for a malformed night', async () => {
    for (const night of ['..%2Fconfig', 'not-a-night']) {
      const res = await createApp(config).request(`/api/digest/${night}`);
      expect(res.status, night).toBe(404);
      expect(await res.json()).toEqual({ error: 'no such night' });
    }
  });

  it('reports 1 bad line for 2026-10-28', async () => {
    const data = (await (await createApp(config).request('/api/digest/2026-10-28')).json()) as DigestJson;
    expect(data.badLines).toBe(1);
    expect(data.rows).toHaveLength(5);
  });

  describe('with a temp runs dir', () => {
    let dir: string;
    let tmpConfig: typeof config;

    beforeAll(() => {
      dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
      writeFileSync(join(dir, '2026-01-01.jsonl'), '');
      writeFileSync(
        join(dir, '2026-01-02.jsonl'),
        [
          '{"at":"2026-01-02T08:00:00+01:00","job":"a/first","status":"ok","owner":"rook"}',
          'not json',
          '{"at":"2026-01-02T09:00:00+01:00","job":"b/second","status":"fail","owner":null,"error":"boom"}',
          '',
        ].join('\n'),
      );
      tmpConfig = { ...config, runsDir: dir };
    });

    afterAll(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    it('answers 200 with no rows for an empty night', async () => {
      const res = await createApp(tmpConfig).request('/api/digest/2026-01-01');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ night: '2026-01-01', rows: [], badLines: 0 });
    });

    it('returns the valid rows and counts the bad line', async () => {
      const res = await createApp(tmpConfig).request('/api/digest/2026-01-02');
      expect(res.status).toBe(200);
      const data = (await res.json()) as DigestJson;
      expect(data.badLines).toBe(1);
      expect(jsonJobs(data)).toEqual(['a/first', 'b/second']);
    });
  });
});

describe('page and JSON agree', () => {
  it('list the same jobs in the same order for 2026-10-28', async () => {
    const app = createApp(config);
    const html = await (await app.request('/digest/2026-10-28')).text();
    const data = (await (await app.request('/api/digest/2026-10-28')).json()) as DigestJson;
    expect(pageJobs(html)).toEqual(jsonJobs(data));
  });
});
