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

const MARKDOWN_ONLY =
  "!(needs.classify.result == 'success' && needs.classify.outputs.markdown_only == 'true')";

const heavyCondition = `if: \${{ !cancelled() && ${MARKDOWN_ONLY} }}\n`;

const skipsOnMarkdownOnly = (block: string): boolean => block.includes(`if: \${{ ${MARKDOWN_ONLY} }}\n`);

describe('the Markdown-only rule', () => {
  it('holds for a list of Markdown files alone', () => {
    expect(isMarkdownOnly(['README.md', 'docs/adr/0001-x.md'], 2)).toBe(true);
  });

  it('fails for a Markdown file beside any other file', () => {
    expect(isMarkdownOnly(['README.md', 'apps/web/app/page.tsx'], 2)).toBe(false);
  });

  it('fails for no files', () => {
    expect(isMarkdownOnly([], 0)).toBe(false);
  });

  it('fails for a name that only looks like Markdown', () => {
    expect(isMarkdownOnly(['docs/guide.mdx'], 1)).toBe(false);
    expect(isMarkdownOnly(['docs/guide.md.bak'], 1)).toBe(false);
    expect(isMarkdownOnly(['md'], 1)).toBe(false);
  });

  it('fails for a listing shorter than the pull request changed files', () => {
    expect(isMarkdownOnly(['README.md'], 2)).toBe(false);
    expect(isMarkdownOnly(['README.md'], Number.NaN)).toBe(false);
  });

  it('holds when renames make the listing longer than the changed files', () => {
    expect(isMarkdownOnly(['new.md', 'old.md'], 1)).toBe(true);
  });

  it('fails for a listing at the cap of 3000 files', () => {
    const files = (count: number): readonly string[] => Array.from({ length: count }, (_, i) => `docs/${String(i)}.md`);

    expect(isMarkdownOnly(files(2999), 2999)).toBe(true);
    expect(isMarkdownOnly(files(3000), 3000)).toBe(false);
  });

  it('answers on the command line from the files on standard input', () => {
    const answer = (input: string, count = '2'): string =>
      spawnSync(process.execPath, [path.join(REPO_ROOT, 'tools', 'markdown-only.ts'), count], {
        input,
        encoding: 'utf8',
      }).stdout.trim();

    expect(answer('README.md\ndocs/a.md\n')).toBe('markdown_only=true');
    expect(answer('README.md\nsrc/a.ts\n')).toBe('markdown_only=false');
    expect(answer('')).toBe('markdown_only=false');
    expect(answer('README.md\ndocs/a.md\n', '3')).toBe('markdown_only=false');
    expect(answer('README.md\ndocs/a.md\n', '')).toBe('markdown_only=false');
  });
});

it.each(['ci.yml', 'e2e-build.yml'])('never starts an if with a YAML indicator in %s', (file) => {
  expect(workflow(file)).not.toMatch(/\n\s+if: [!*&]/);
});

describe('the shared classification', () => {
  const text = workflow('classify-changed-files.yml');
  const classify = jobBlock(text, 'classify');

  it('reads the changed files of a pull request, renames included, through the one function', () => {
    expect(classify).toContain('| node tools/markdown-only.ts "$CHANGED_FILES" >> "$GITHUB_OUTPUT"');
    expect(classify).toContain('CHANGED_FILES: ${{ github.event.pull_request.changed_files }}\n');
    expect(classify).toContain("--jq '.[] | .filename, (.previous_filename // empty)'");
  });

  it("runs the classifier from the base branch, never the pull request's own copy", () => {
    expect(classify).toContain('ref: ${{ github.event.pull_request.base.sha || github.sha }}\n');
  });

  it('classifies a pull request and never a push', () => {
    const step = stepBlock(classify, 'Markdown-only pull request');

    expect(step).toContain('id: classify\n');
    expect(step).toContain("if: github.event_name == 'pull_request'\n");
    expect(classify).toContain("markdown_only: ${{ steps.classify.outputs.markdown_only || 'false' }}\n");
  });

  it('is called by ci.yml and e2e-build.yml as the job classify', () => {
    for (const file of ['ci.yml', 'e2e-build.yml']) {
      expect(jobBlock(workflow(file), 'classify')).toContain(
        'uses: ./.github/workflows/classify-changed-files.yml\n',
      );
    }
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
    expect(job).toContain(heavyCondition);
  });

  it('keeps Gate liveness running and its shape gates unconditional', () => {
    const job = jobBlock(ci, 'gate-liveness');

    expect(job).toContain('needs: classify\n');
    expect(job).toContain('if: ${{ !cancelled() }}\n');
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
  const job = jobBlock(workflow('e2e-build.yml'), 'e2e-build');
  const steps = job.slice(job.indexOf('\n    steps:\n')).split(/\n {6}- /).slice(1);

  it('runs the job, so it resolves its own name, and skips every step', () => {
    expect(job).toContain('needs: classify\n');
    expect(job).toContain('if: ${{ !cancelled() }}\n');
    expect(job).toContain("|| 'E2E build' }}");
    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) expect(step).toContain(MARKDOWN_ONLY);
  });
});
