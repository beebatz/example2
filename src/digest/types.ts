export type JobStatus = 'ok' | 'retry' | 'fail';

// One row per job in a night's run log. Times keep the offset from the log (never converted to UTC).
export type DigestRow = {
  job: string;
  owner: string | null; // null renders as "—"
  runs: number; // log lines for this job
  retries: number; // lines with status "retry"
  lastStatus: JobStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type Night = {
  rows: DigestRow[]; // sorted by job
  badLines: number; // lines that did not parse; counted, never thrown
};

// null = no file for that night. An empty file is a Night with no rows.
export type ReadNight = (runsDir: string, night: string) => Night | null;
