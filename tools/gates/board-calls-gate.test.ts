import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BOARD_CALLS_ALLOWED_IN,
  BOARD_RULE_SENTENCE,
  findBoardCallProblems,
  ISSUE_TRACKER_GUIDE,
} from './board-calls';
import type { DocFile } from './agents-shape';
import { REPO_ROOT, runGate } from './run-gate';

const file = (filePath: string, content: string): DocFile => ({ path: filePath, content });

const guide = file(ISSUE_TRACKER_GUIDE, BOARD_RULE_SENTENCE);

const scan = (...files: readonly DocFile[]): readonly string[] =>
  findBoardCallProblems([guide, ...files]);

const trackedTextFiles = (): readonly DocFile[] => {
  const run = runGate('git', ['ls-files', '-z'], REPO_ROOT);
  expect(run.status, `git ls-files must succeed\n${run.stderr}`).toBe(0);

  return run.stdout
    .split('\0')
    .filter((name) => name !== '')
    .map((name) => file(name, readFileSync(path.join(REPO_ROOT, name), 'utf8')));
};

describe('the board calls', () => {
  it.each([
    ['gh project', 'run: gh project item-list'],
    ['gh project', 'gh   project item-list'],
    ['projectV2', 'query { projectV2(number: 2) }'],
    ['projectItems', 'node { projectItems(first: 1) }'],
    ["'project',", "execFile('gh', ['project', 'list'])"],
    ['"project",', 'exec("gh", ["project", "list"])'],
  ])('reports %s outside the allowed places, naming the file', (name, content) => {
    const problems = scan(file('scripts/other.ts', content));

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('scripts/other.ts');
    expect(problems[0]).toContain(`'${name}'`);
  });

  it.each([
    ['gh project', 'GH PROJECT'],
    ['gh project', 'Gh Project'],
    ['projectV2', 'PROJECTV2'],
    ['projectV2', 'ProjectV2ItemFieldSingleSelectValue'],
    ['projectItems', 'PROJECTITEMS'],
    ['projectItems', 'ProjectItems'],
    ["'project',", "['PROJECT', 'x']"],
    ["'project',", "['Project',"],
    ['"project",', '["PROJECT",'],
    ['"project",', '["Project",'],
  ])('reports %s in the form %s', (name, content) => {
    const problems = scan(file('a.ts', content));

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(`'${name}'`);
  });

  it('skips a file that is not text', () => {
    expect(
      scan(file('logo.png', 'gh project\0projectV2')),
    ).toEqual([]);
  });

  it('reports a scan holding only files that are not text as broken', () => {
    expect(findBoardCallProblems([file('logo.png', '\0gh project')])[0]).toContain(
      'scan is broken',
    );
  });

  it('reports the rule sentence missing when the guide is not in the file list', () => {
    const problems = findBoardCallProblems([file('a.ts', 'ok')]);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(BOARD_RULE_SENTENCE);
    expect(problems[0]).toContain('was not found');
  });

  it('does not report a word that merely contains project', () => {
    expect(scan(file('a.ts', 'the project, a projection'))).toEqual([]);
  });

  it.each(BOARD_CALLS_ALLOWED_IN)('does not report %s', (allowed) => {
    expect(
      scan(file(allowed, "gh project projectV2 projectItems 'project',")),
    ).toEqual([]);
  });

  it('passes the guide holding only the rule sentence, wrapped at any width', () => {
    const wrapped = BOARD_RULE_SENTENCE.replaceAll(' ', '\n');

    expect(findBoardCallProblems([file(ISSUE_TRACKER_GUIDE, `intro\n\n${wrapped}\n`)])).toEqual(
      [],
    );
  });

  it('reports a board command elsewhere in the guide', () => {
    const problems = findBoardCallProblems([
      file(ISSUE_TRACKER_GUIDE, `${BOARD_RULE_SENTENCE}\n\ngh project item-list\n`),
    ]);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(ISSUE_TRACKER_GUIDE);
    expect(problems[0]).toContain("'gh project'");
  });

  it('reports a guide without the rule sentence, naming the sentence', () => {
    const problems = findBoardCallProblems([file(ISSUE_TRACKER_GUIDE, 'nothing here\n')]);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(BOARD_RULE_SENTENCE);
  });

  it('reports an empty file list as a broken scan', () => {
    const problems = findBoardCallProblems([]);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('scan is broken');
  });

  it('passes the repository as it stands', () => {
    const files = trackedTextFiles();

    expect(files.length).toBeGreaterThan(0);
    expect(findBoardCallProblems(files)).toEqual([]);
  });
});
