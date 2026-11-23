export type RepoFile = {
  readonly path: string;
  readonly content: string;
};

export const BOARD_CALLS_ALLOWED_IN: readonly string[] = [
  'tools/board.ts',
  'tools/gates/board-gate.test.ts',
  'tools/gates/board-calls.ts',
  'tools/gates/board-calls-gate.test.ts',
];

export const ISSUE_TRACKER_GUIDE = 'docs/agents/issue-tracker.md';

export const BOARD_RULE_SENTENCE =
  'Nothing else runs a `gh project` command, queries `projectV2` or requests `projectItems`.';

const BOARD_PATTERNS: readonly (readonly [name: string, pattern: RegExp])[] = [
  ['gh project', /gh\s+project/i],
  ['projectV2', /projectV2/i],
  ['projectItems', /projectItems/i],
  ['\'project\',', /'project',/i],
  ['"project",', /"project",/i],
];

const collapse = (text: string): string => text.replaceAll(/\s+/g, ' ');

const patternsIn = (content: string): readonly string[] =>
  BOARD_PATTERNS.flatMap(([name, pattern]) => (pattern.test(content) ? [name] : []));

export function findBoardCallProblems(files: readonly RepoFile[]): readonly string[] {
  if (files.length === 0) {
    return [
      'no tracked file was found, so nothing was compared. The scan is broken, not the ' +
        'repository empty.',
    ];
  }

  const problems: string[] = [];

  for (const file of files) {
    if (BOARD_CALLS_ALLOWED_IN.includes(file.path)) continue;

    let content = file.content;
    if (file.path === ISSUE_TRACKER_GUIDE) {
      const collapsed = collapse(file.content);
      if (!collapsed.includes(BOARD_RULE_SENTENCE)) {
        problems.push(
          `${file.path}: needs the rule sentence '${BOARD_RULE_SENTENCE}', which the board ` +
            'gate pins',
        );
      }
      content = collapsed.replace(BOARD_RULE_SENTENCE, '');
    }

    for (const name of patternsIn(content)) {
      problems.push(
        `${file.path}: contains '${name}', and only the board tool may call the board`,
      );
    }
  }

  return problems;
}
