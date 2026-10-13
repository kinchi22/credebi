import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { bin } from './gates/run-gate.ts';

export type ReportError = {
  readonly message: string;
  readonly location?: { readonly file: string; readonly line: number };
};

export type ReportResult = { readonly status: string; readonly errors: readonly ReportError[] };

export type ReportSpec = {
  readonly title: string;
  readonly file: string;
  readonly line: number;
  readonly tests: readonly { readonly status: string; readonly results: readonly ReportResult[] }[];
};

export type ReportSuite = { readonly specs: readonly ReportSpec[]; readonly suites?: readonly ReportSuite[] };

export type LivenessReport = {
  readonly config: { readonly rootDir: string; readonly workers?: number };
  readonly errors: readonly { readonly message: string }[];
  readonly suites: readonly ReportSuite[];
};

export type LivenessRun = {
  readonly problems: readonly string[];
  readonly report: LivenessReport | undefined;
};

const LIVENESS_WORKERS = 2;

const firstLine = (message: string): string =>
  stripVTControlCharacters(message).split('\n')[0] ?? '';

export const specsIn = (suites: readonly ReportSuite[]): readonly ReportSpec[] =>
  suites.flatMap((suite) => [...suite.specs, ...specsIn(suite.suites ?? [])]);

export function findLivenessProblems(report: LivenessReport, requests: number): readonly string[] {
  const problems: string[] = [];

  if (report.errors.length > 0) {
    problems.push(
      'Playwright reported an error outside any spec:',
      ...report.errors.map((error) => `  ${firstLine(error.message)}`),
    );
  }

  const specs = specsIn(report.suites);
  if (specs.length === 0) {
    problems.push('no specs ran, so none was shown to fail. Check testDir in playwright.config.ts.');
  }

  const inSpecDirectory = ({ location }: ReportError): boolean => {
    if (location === undefined) return false;
    const relative = path.relative(report.config.rootDir, location.file);
    return !relative.startsWith('..') && !path.isAbsolute(relative);
  };

  for (const spec of specs) {
    const name = `${spec.file}:${String(spec.line)} ${spec.title}`;

    for (const test of spec.tests) {
      if (test.status === 'skipped') {
        problems.push(`was skipped, so it asserts nothing: ${name}`);
        continue;
      }
      if (test.status !== 'unexpected') {
        problems.push(`passed against an empty page, so it asserts nothing the app provides: ${name}`);
        continue;
      }
      const outside = test.results.find((result) => !result.errors.some(inSpecDirectory));
      if (outside !== undefined) {
        problems.push(
          `failed outside the spec, so its own assertions never ran: ${name}`,
          ...outside.errors.slice(0, 1).map((error) => `  ${firstLine(error.message)}`),
        );
      }
    }
  }

  if (requests === 0) {
    problems.push('the empty page was never requested, so the specs did not run against it.');
  }

  return problems;
}

export type PlaywrightRun = {
  readonly exitStatus: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly report: LivenessReport | undefined;
};

export type PlaywrightInvocation = {
  readonly cwd: string;
  readonly args: readonly string[];
  readonly env: NodeJS.ProcessEnv;
  readonly reportFile: string;
};

export const noReport = ({ exitStatus, signal }: PlaywrightRun): string =>
  signal === null
    ? `Playwright wrote no report (exit status ${String(exitStatus)}).`
    : `Playwright was stopped by ${signal} before it wrote a report.`;

export async function runPlaywright({
  cwd,
  args,
  env,
  reportFile,
}: PlaywrightInvocation): Promise<PlaywrightRun> {
  rmSync(reportFile, { force: true });
  const { exitStatus, signal } = await new Promise<Omit<PlaywrightRun, 'report'>>(
    (resolve, reject) => {
      const child = spawn(bin('playwright'), ['test', ...args], {
        cwd,
        stdio: 'inherit',
        env: { ...process.env, ...env, PLAYWRIGHT_JSON_OUTPUT_NAME: reportFile },
      });
      const forward = (received: NodeJS.Signals): void => {
        child.kill(received);
      };
      process.on('SIGINT', forward).on('SIGTERM', forward);
      child.on('error', reject);
      child.on('close', (code, stopped) => {
        process.off('SIGINT', forward).off('SIGTERM', forward);
        resolve({ exitStatus: code, signal: stopped });
      });
    },
  );

  const report = existsSync(reportFile)
    ? (JSON.parse(readFileSync(reportFile, 'utf8')) as LivenessReport)
    : undefined;
  return { exitStatus, signal, report };
}

export async function runAgainstEmptyPage(
  repoRoot: string,
  configFile?: string,
): Promise<LivenessRun> {
  let requests = 0;
  const server = createServer((request, response) => {
    requests += 1;
    response.writeHead(request.url === '/' ? 200 : 404, { 'content-type': 'text/html' }).end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;

  const directory = mkdtempSync(path.join(tmpdir(), 'e2e-liveness-'));

  try {
    const run = await runPlaywright({
      cwd: repoRoot,
      args: [
        `--workers=${String(LIVENESS_WORKERS)}`,
        '--retries=0',
        '--forbid-only',
        '--reporter=json',
        ...(configFile === undefined ? [] : ['--config', configFile]),
      ],
      env: { E2E_LIVENESS: '1', E2E_BASE_URL: `http://127.0.0.1:${String(port)}` },
      reportFile: path.join(directory, 'report.json'),
    });
    const { report } = run;

    if (report === undefined) {
      return { problems: [noReport(run)], report: undefined };
    }

    const problems = findLivenessProblems(report, requests);
    if (problems.length === 0) {
      console.log(
        `E2E gate is alive: all ${String(specsIn(report.suites).length)} specs failed against an empty page, each on a line of its own.`,
      );
    }
    return { problems, report };
  } finally {
    server.close();
    rmSync(directory, { recursive: true, force: true });
  }
}
