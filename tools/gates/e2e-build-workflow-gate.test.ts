import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from './run-gate';

const workflow = readFileSync(path.join(REPO_ROOT, '.github', 'workflows', 'e2e-build.yml'), 'utf8');

type Value = string | number | boolean | null | readonly Value[] | { readonly [key: string]: Value };

type Context = { readonly [key: string]: Value };

const TOKEN = /\s*(\|\||&&|==|!=|!|\(|\)|,|\.|'(?:[^']|'')*'|\d+|[A-Za-z_][\w-]*)/y;

function tokenize(source: string): readonly string[] {
  const tokens: string[] = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < source.trimEnd().length) {
    const match = TOKEN.exec(source);
    if (match?.[1] === undefined) throw new Error(`cannot read the expression at ${String(TOKEN.lastIndex)}: ${source}`);
    tokens.push(match[1]);
  }
  return tokens;
}

const truthy = (value: Value): boolean => value !== null && value !== false && value !== 0 && value !== '';

const equal = (left: Value, right: Value): boolean =>
  typeof left === 'string' && typeof right === 'string' ? left.toLowerCase() === right.toLowerCase() : left === right;

const asText = (value: Value | undefined): string =>
  typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);

const FUNCTIONS: Record<string, (...args: Value[]) => Value> = {
  startsWith: (text, prefix) => asText(text).toLowerCase().startsWith(asText(prefix).toLowerCase()),
  fromJSON: (text) => JSON.parse(asText(text)) as Value,
  always: () => true,
};

function evaluate(source: string, context: Context): Value {
  const tokens = tokenize(source);
  let position = 0;
  const peek = (): string | undefined => tokens[position];
  const take = (expected?: string): string => {
    const token = tokens[position];
    if (token === undefined || (expected !== undefined && token !== expected)) {
      throw new Error(`expected ${expected ?? 'a token'} at ${String(position)} in ${source}`);
    }
    position += 1;
    return token;
  };

  const primary = (): Value => {
    const token = take();
    if (token === '(') {
      const inner = or();
      take(')');
      return inner;
    }
    if (token === '!') return !truthy(primary());
    if (token.startsWith("'")) return token.slice(1, -1).replaceAll("''", "'");
    if (/^\d+$/.test(token)) return Number(token);
    if (peek() === '(') {
      take('(');
      const args: Value[] = [];
      while (peek() !== ')') {
        args.push(or());
        if (peek() === ',') take(',');
      }
      take(')');
      const call = FUNCTIONS[token];
      if (call === undefined) throw new Error(`unknown function ${token}`);
      return call(...args);
    }
    let value: Value = context[token] ?? null;
    while (peek() === '.') {
      take('.');
      const key = take();
      value = value !== null && typeof value === 'object' && !Array.isArray(value)
        ? ((value as Context)[key] ?? null)
        : null;
    }
    return value;
  };

  const comparison = (): Value => {
    const left = primary();
    const operator = peek();
    if (operator === '==' || operator === '!=') {
      take();
      const right = primary();
      return operator === '==' ? equal(left, right) : !equal(left, right);
    }
    return left;
  };

  const and = (): Value => {
    let value = comparison();
    while (peek() === '&&') {
      take();
      const right = comparison();
      value = truthy(value) ? right : value;
    }
    return value;
  };

  const or = (): Value => {
    let value = and();
    while (peek() === '||') {
      take();
      const right = and();
      value = truthy(value) ? value : right;
    }
    return value;
  };

  const result = or();
  if (position !== tokens.length) throw new Error(`unread tokens in ${source}`);
  return result;
}

const interpolate = (text: string, context: Context): Value => {
  const whole = /^\$\{\{([\s\S]*)\}\}$/.exec(text.trim());
  if (whole?.[1] !== undefined) return evaluate(whole[1], context);
  return text.replace(/\$\{\{([\s\S]*?)\}\}/g, (_, inner: string) => asText(evaluate(inner, context)));
};

const job = workflow.slice(workflow.indexOf('\n  e2e-build:\n'));
const steps = job
  .slice(job.indexOf('\n    steps:\n'))
  .split(/\n {6}- /)
  .slice(1)
  .map((step) => `- ${step}`);

const field = (text: string, key: string): string | undefined => {
  const match = new RegExp(`(?:^|\\n)\\s*(?:- )?${key}: (>-\\n)?([\\s\\S]*?)(?=\\n\\s*(?:- )?[\\w-]+:|\\n\\s*#|$)`).exec(text);
  return match?.[2]?.replace(/\s*\n\s*/g, ' ').trim();
};

const required = (value: string | undefined, what: string): string => {
  if (value === undefined) throw new Error(`${what} is missing from e2e-build.yml`);
  return value;
};

const stepNamed = (name: string): string => required(steps.find((step) => step.includes(`name: ${name}\n`)), `the step ${name}`);

const uploads = steps.filter((step) => step.includes('uses: actions/upload-artifact@'));

const EVENTS = {
  'a pull request into main': { github: { event_name: 'pull_request', ref: 'refs/pull/7/merge' } },
  'a push to main': { github: { event_name: 'push', ref: 'refs/heads/main' } },
  'a push to a milestone': { github: { event_name: 'push', ref: 'refs/heads/milestone/titles' } },
} as const;

const legsOf = (event: keyof typeof EVENTS): readonly string[] =>
  interpolate(required(field(job, 'suite'), 'the matrix'), EVENTS[event]) as readonly string[];

const nameOf = (suite: string): Value =>
  interpolate(required(field(job, 'name'), 'the job name'), { matrix: { suite } });

const runs = (step: string, suite: string, outcome?: string): boolean => {
  const condition = field(step, 'if');
  if (condition === undefined) return outcome === undefined || outcome === 'success';
  const status = outcome === undefined || outcome === 'success' ? 'success' : outcome;
  const always = condition.includes('always()');
  if (!always && status !== 'success') return false;
  return truthy(
    evaluate(condition, {
      matrix: { suite },
      steps: { advisory: { outcome: outcome ?? 'success' } },
    }),
  );
};

describe('the E2E build workflow', () => {
  it('keeps its triggers and its cancellation of superseded runs', () => {
    expect(workflow).toContain(
      "\non:\n  pull_request:\n    branches: [main]\n  push:\n    branches: [main, 'milestone/**']\n",
    );
    expect(workflow).toContain('\nconcurrency:\n  group: e2e-build-${{ github.ref }}\n  cancel-in-progress: true\n');
  });

  it.each([['a pull request into main'], ['a push to main']] as const)(
    'runs the whole suite once, as the required E2E build, on %s',
    (event) => {
      expect(legsOf(event)).toEqual(['strict']);
      expect(nameOf('strict')).toBe('E2E build');
    },
  );

  it('splits a milestone push into the existing and Feature groups, each under a name of its own', () => {
    const legs = legsOf('a push to a milestone');
    const names = legs.map(nameOf);

    expect(legs).toEqual(['existing', 'feature']);
    expect(names).toEqual(['E2E build (advisory, existing specs)', 'E2E build (advisory, Feature specs)']);
    expect(names).not.toContain('E2E build (advisory)');
  });

  it('gives each leg its own 20-minute budget, preparation included, and lets neither cancel the other', () => {
    expect(job).toMatch(/\n {4}timeout-minutes: 20\n/);
    expect(job).toMatch(/\n {4}strategy:\n {6}fail-fast: false\n/);
    expect(job).not.toMatch(/\n {4}(needs|continue-on-error):/);
    expect(workflow.match(/\n {2}[\w-]+:\n {4}(name|runs-on):/g)).toHaveLength(1);
  });

  it('fetches the whole history, main included, for a group and keeps the strict checkout shallow', () => {
    const checkout = required(steps.find((step) => step.includes('uses: actions/checkout@')), 'the checkout');
    const depth = required(field(checkout, 'fetch-depth'), 'the fetch depth');

    expect(interpolate(depth, { matrix: { suite: 'strict' } })).toBe(1);
    expect(interpolate(depth, { matrix: { suite: 'existing' } })).toBe(0);
    expect(interpolate(depth, { matrix: { suite: 'feature' } })).toBe(0);
  });

  it('runs the strict suite only in the strict leg, and each group through the command that selects it', () => {
    const strict = stepNamed('7. test:e2e');
    const advisory = stepNamed('7. test:e2e:advisory');

    expect(field(strict, 'run')).toBe('pnpm test:e2e');
    expect(field(advisory, 'run')).toBe('pnpm test:e2e:advisory "$SUITE" --base origin/main');
    expect(field(advisory, 'SUITE')).toBe('${{ matrix.suite }}');
    expect(field(advisory, 'id')).toBe('advisory');
    expect(['strict', 'existing', 'feature'].map((suite) => [runs(strict, suite), runs(advisory, suite)])).toEqual([
      [true, false],
      [false, true],
      [false, true],
    ]);
    for (const key of ['DATABASE_URL', 'AUTH_TEST_LOGIN', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']) {
      expect(field(advisory, key)).toBe(field(strict, key));
    }
    expect(advisory).not.toMatch(/E2E_LIVENESS|E2E_ADVISORY|--retries|--timeout|--workers/);
  });

  it('uploads each leg under an artifact name of its own', () => {
    const names = ['strict', 'existing', 'feature'].flatMap((suite) =>
      uploads.filter((step) => runs(step, suite, 'failure')).map((step) => interpolate(required(field(step, 'name'), 'an artifact name'), { matrix: { suite } })),
    );

    expect(names).toEqual(['playwright-report-build', 'playwright-report-advisory-existing', 'playwright-report-advisory-feature']);
  });

  it('uploads a group report and its traces after a failure, never after an interrupted or skipped run', () => {
    const [upload, ...rest] = uploads.filter((step) => runs(step, 'feature', 'failure'));
    const paths = interpolate(required(/path: \|\n([\s\S]*?)\n\s+if-no-files-found/.exec(upload ?? '')?.[1], 'the paths'), { matrix: { suite: 'feature' } });

    expect(rest).toEqual([]);
    expect(asText(paths).split('\n').map((line) => line.trim())).toEqual([
      'playwright-report/advisory-feature',
      'test-results/advisory-feature',
    ]);
    expect(['success', 'failure', 'cancelled', 'skipped'].map((outcome) => uploads.some((step) => runs(step, 'existing', outcome)))).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });

  it('keeps uploading the strict report whatever the strict run did', () => {
    expect(['success', 'failure', 'cancelled'].map((outcome) => uploads.filter((step) => runs(step, 'strict', outcome)).length)).toEqual([1, 1, 1]);
  });
});
