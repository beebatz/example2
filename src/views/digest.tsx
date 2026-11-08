import type { DigestRow, Night } from '../digest/types.js';

// A row is marked when it retried 3 or more times or its last run failed. The mark is text
// too (a "⚠" in the status cell), so it reads without colour.
export function isWarn(row: DigestRow): boolean {
  return row.retries >= 3 || row.lastStatus === 'fail';
}

// Missing data renders as a dash, never as an empty cell.
const dash = (v: string | null): string => (v === null ? '—' : v);

export function DigestPage({ night, data }: { night: string; data: Night }) {
  return (
    <>
      <h1>digest · {night}</h1>
      {data.badLines > 0 ? (
        <p class="warn">
          {data.badLines} bad {data.badLines === 1 ? 'line' : 'lines'} skipped
        </p>
      ) : null}
      {data.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => {
              const warn = isWarn(r);
              return (
                <tr class={warn ? 'warn' : undefined}>
                  <td>{r.job}</td>
                  <td>{dash(r.owner)}</td>
                  <td>{r.runs}</td>
                  <td>{r.retries}</td>
                  <td>
                    {warn ? '⚠ ' : ''}
                    {r.lastStatus}
                  </td>
                  <td>{dash(r.lastError)}</td>
                  <td>{r.firstAt}</td>
                  <td>{r.lastAt}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

export function NoNight({ night }: { night: string }) {
  return (
    <>
      <h1>digest · {night}</h1>
      <p class="mute">no run log for this night</p>
    </>
  );
}
