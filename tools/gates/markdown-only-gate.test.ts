import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isMarkdownOnly } from '../markdown-only';
import { REPO_ROOT } from './run-gate';

const workflow = (name: string): string =>
  readFileSync(path.join(REPO_ROOT, '.github', 'workflows', name), 'utf8');

const jobBlock = (text: string, id: string): string => {
  const start = text.indexOf(`\n  ${id}:\n`);
  if (start === -1) throw new Error(`the job ${id} is missing`);
  const next = text.slice(start + 1).search(/\n {2}[\w-]+:\n/);
  return next === -1 ? text.slice(start) : text.slice(start, start + 1 + next);
};

const stepBlock = (job: string, name: string): string => {
  const start = job.indexOf(`      - name: ${name}\n`);
  if (start === -1) throw new Error(`the step ${name} is missing`);
  const next = job.slice(start + 1).search(/\n {6}- /);
  return next === -1 ? job.slice(start) : job.slice(start, start + 1 + next);
};

const SKIPPED_WHEN_MARKDOWN_ONLY = "needs.classify.outputs.markdown_only != 'true'";

const skipsOnMarkdownOnly = (block: string): boolean => block.includes(`if: ${SKIPPED_WHEN_MARKDOWN_ONLY}\n`);

describe('the Markdown-only rule', () => {
  it('holds for a list of Markdown files alone', () => {
    expect(isMarkdownOnly(['README.md', 'docs/adr/0001-x.md'])).toBe(true);
  });

  it('fails for a Markdown file beside any other file', () => {
    expect(isMarkdownOnly(['README.md', 'apps/web/app/page.tsx'])).toBe(false);
  });

  it('fails for no files', () => {
    expect(isMarkdownOnly([])).toBe(false);
  });

  it('fails for a name that only looks like Markdown', () => {
    expect(isMarkdownOnly(['docs/guide.mdx'])).toBe(false);
    expect(isMarkdownOnly(['docs/guide.md.bak'])).toBe(false);
    expect(isMarkdownOnly(['md'])).toBe(false);
  });

  it('answers on the command line from the files on standard input', () => {
    const answer = (input: string): string =>
      spawnSync(process.execPath, [path.join(REPO_ROOT, 'tools', 'markdown-only.ts')], {
        input,
        encoding: 'utf8',
      }).stdout.trim();

    expect(answer('README.md\ndocs/a.md\n')).toBe('markdown_only=true');
    expect(answer('README.md\nsrc/a.ts\n')).toBe('markdown_only=false');
    expect(answer('')).toBe('markdown_only=false');
  });
});

describe.each([
  ['ci.yml', 'Classify changed files (CI)'],
  ['e2e-build.yml', 'Classify changed files (E2E build)'],
])('the classification in %s', (file, name) => {
  const text = workflow(file);
  const classify = jobBlock(text, 'classify');

  it('is a job of its own that reads the changed files of a pull request through the one function', () => {
    expect(classify).toContain(`name: ${name}\n`);
    expect(classify).toContain('| node tools/markdown-only.ts >> "$GITHUB_OUTPUT"');
    expect(classify).toContain("--jq '.[] | .filename, (.previous_filename // empty)'");
  });

  it('classifies a pull request and never a push', () => {
    const step = stepBlock(classify, 'Markdown-only pull request');

    expect(step).toContain('id: classify\n');
    expect(step).toContain("if: github.event_name == 'pull_request'\n");
    expect(classify).toContain("markdown_only: ${{ steps.classify.outputs.markdown_only || 'false' }}\n");
  });
});

describe('what a Markdown-only pull request skips in ci.yml', () => {
  const ci = workflow('ci.yml');

  it.each([
    ['gates', 'Gates'],
    ['integration', 'Integration'],
    ['mutation', 'Mutation testing'],
  ])('skips %s by if, under its required name', (id, name) => {
    const job = jobBlock(ci, id);

    expect(job).toContain(`name: ${name}\n`);
    expect(job).toContain('needs: classify\n');
    expect(skipsOnMarkdownOnly(job)).toBe(true);
  });

  it('keeps Gate liveness running and its shape gates unconditional', () => {
    const job = jobBlock(ci, 'gate-liveness');

    expect(job).toContain('needs: classify\n');
    expect(job).not.toMatch(/\n {4}if:/);
    expect(stepBlock(job, 'Fixture and shape gates')).not.toContain('if:');
    expect(stepBlock(job, 'Fixture and shape gates')).toContain('run: pnpm verify:gates\n');
  });

  it.each([
    'server-only build fixture',
    'Mutation threshold fixture',
    'Migration drift fixture',
    'Install Playwright browsers',
    'E2E specs fail against an empty page',
  ])('skips the Gate liveness step %s', (name) => {
    expect(skipsOnMarkdownOnly(stepBlock(jobBlock(ci, 'gate-liveness'), name))).toBe(true);
  });

  it('installs Playwright through the step that is skipped', () => {
    expect(stepBlock(jobBlock(ci, 'gate-liveness'), 'Install Playwright browsers')).toContain(
      'run: pnpm exec playwright install --with-deps chromium webkit\n',
    );
  });

  it('leaves Spec isolation, the release and readiness as they are', () => {
    expect(jobBlock(ci, 'isolation')).toContain("if: github.event_name == 'pull_request'\n");
    expect(jobBlock(ci, 'isolation')).not.toContain('classify');
    expect(jobBlock(ci, 'release')).not.toContain('classify');
    expect(jobBlock(ci, 'production-ready')).not.toContain('classify');
  });
});

describe('what a Markdown-only pull request skips in e2e-build.yml', () => {
  it('skips the E2E build by if, under its required name', () => {
    const job = jobBlock(workflow('e2e-build.yml'), 'e2e-build');

    expect(job).toContain('needs: classify\n');
    expect(skipsOnMarkdownOnly(job)).toBe(true);
    expect(job).toContain("|| 'E2E build' }}");
  });
});
