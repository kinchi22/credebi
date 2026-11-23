import { spawnSync, type SpawnSyncReturns } from 'node:child_process';

const PROJECT = {
  number: '2',
  owner: 'kinchi22',
  repository: 'credebi',
} as const;

const STATUS_FIELD = 'PVTSSF_lAHOAPo8ps4Bj5BZzhirtAQ';
const PROJECT_ID = 'PVT_kwHOAPo8ps4Bj5BZ';

const STATUS_OPTIONS = {
  Backlog: 'f75ad846',
  Ready: '412e474e',
  'In Progress': '47fc9ee4',
  'In Review': '02ce40ea',
  Done: '98236657',
} as const;

export type StatusName = keyof typeof STATUS_OPTIONS;

export const STATUS_NAMES = Object.keys(STATUS_OPTIONS) as readonly StatusName[];

export type BoardEnv = Readonly<Record<string, string | undefined>>;

export type GhRunner = (args: readonly string[], env: BoardEnv) => string;

export type BoardDeps = {
  readonly env: BoardEnv;
  readonly gh: GhRunner;
};

export function isStatusName(value: string): value is StatusName {
  return Object.hasOwn(STATUS_OPTIONS, value);
}

function boardEnv(env: BoardEnv): BoardEnv {
  const token = env['BOARD_TOKEN'];
  if (token === undefined || token === '') {
    throw new Error('BOARD_TOKEN is not set. Board operations need a personal access token with the project and read:org scopes.');
  }
  const { GITHUB_TOKEN: _dropped, ...rest } = env;
  return { ...rest, GH_TOKEN: token };
}

export function readStatus(issue: number, deps: BoardDeps): string | undefined {
  const env = boardEnv(deps.env);
  const name = deps.gh(
    [
      'api',
      'graphql',
      '-F',
      `number=${String(issue)}`,
      '-f',
      `query=query($number: Int!) { repository(owner: "${PROJECT.owner}", name: "${PROJECT.repository}") { issue(number: $number) { projectItems(first: 20) { nodes { project { number } fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } } } } } } }`,
      '--jq',
      `.data.repository.issue.projectItems.nodes[] | select(.project.number == ${PROJECT.number}) | .fieldValueByName.name // empty`,
    ],
    env,
  );
  return name === '' ? undefined : name;
}

export function setStatus(issue: number, status: StatusName, deps: BoardDeps): void {
  const env = boardEnv(deps.env);
  const url = `https://github.com/${PROJECT.owner}/${PROJECT.repository}/issues/${String(issue)}`;
  const item = deps.gh(
    ['project', 'item-add', PROJECT.number, '--owner', PROJECT.owner, '--url', url, '--format', 'json', '--jq', '.id'],
    env,
  );
  deps.gh(
    [
      'project',
      'item-edit',
      '--project-id',
      PROJECT_ID,
      '--id',
      item,
      '--field-id',
      STATUS_FIELD,
      '--single-select-option-id',
      STATUS_OPTIONS[status],
    ],
    env,
  );
}

export function ghFailure(result: SpawnSyncReturns<string>): string | undefined {
  if (result.error) return `gh could not be started: ${result.error.message}`;
  if (result.signal) return `gh was killed by ${result.signal}\n${result.stderr}`;
  if (result.status !== 0) return result.stderr;
  return undefined;
}

export const spawnGh: GhRunner = (args, env) => {
  const result = spawnSync('gh', [...args], { encoding: 'utf8', shell: false, env: { ...env } });
  const failure = ghFailure(result);
  if (failure !== undefined) throw new Error(failure);
  return result.stdout.trim();
};

export const processBoard: BoardDeps = { env: process.env, gh: spawnGh };

function usage(): never {
  console.error(`Usage: node tools/board.ts status <issue>\n       node tools/board.ts set <issue> <${STATUS_NAMES.join(' | ')}>`);
  return process.exit(2);
}

if (import.meta.main) {
  const [command, rawIssue, rawStatus] = process.argv.slice(2);
  const issue = Number(rawIssue);
  if (!Number.isInteger(issue) || issue <= 0) usage();
  try {
    if (command === 'status' && rawStatus === undefined) {
      console.log(readStatus(issue, processBoard) ?? 'not on the board');
    } else if (command === 'set' && rawStatus !== undefined && isStatusName(rawStatus)) {
      setStatus(issue, rawStatus, processBoard);
      console.log(`#${String(issue)} is ${rawStatus}.`);
    } else {
      usage();
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
