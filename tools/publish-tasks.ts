import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const PROJECT = {
  number: '2',
  owner: 'kinchi22',
  id: 'PVT_kwHOAPo8ps4Bj5BZ',
  statusField: 'PVTSSF_lAHOAPo8ps4Bj5BZzhirtAQ',
  ready: '412e474e',
} as const;

export type Blocker = string | number;

export type TaskPlan = {
  readonly title: string;
  readonly body: string;
  readonly blockedBy: readonly Blocker[];
  readonly assignee: string | undefined;
};

export type Manifest = {
  readonly feature: number;
  readonly tasks: readonly TaskPlan[];
};

export type Tracker = {
  readonly subIssues: (feature: number) => ReadonlyMap<string, number>;
  readonly create: (task: TaskPlan) => number;
  readonly addSubIssue: (feature: number, task: number) => void;
  readonly blockers: (task: number) => ReadonlySet<number>;
  readonly addBlocker: (task: number, blocker: number) => void;
  readonly status: (issue: number) => string | undefined;
  readonly setReady: (issue: number) => void;
};

export type Published = {
  readonly title: string;
  readonly number: number;
  readonly created: boolean;
  readonly blockedBy: readonly number[];
};

export function checkManifest(manifest: Manifest): readonly string[] {
  const problems: string[] = [];
  const earlier = new Set<string>();
  for (const task of manifest.tasks) {
    if (task.title.trim() === '') problems.push('A Task has an empty title.');
    if (earlier.has(task.title)) problems.push(`"${task.title}" is listed twice.`);
    for (const blocker of task.blockedBy) {
      if (typeof blocker === 'string' && !earlier.has(blocker)) {
        problems.push(`"${task.title}" is blocked by "${blocker}", which is not a Task listed before it.`);
      }
    }
    earlier.add(task.title);
  }
  return problems;
}

function resolve(blocker: Blocker, numbers: ReadonlyMap<string, number>): number {
  if (typeof blocker === 'number') return blocker;
  const found = numbers.get(blocker);
  if (found === undefined) throw new Error(`"${blocker}" has no issue number.`);
  return found;
}

function setReadyUnlessStarted(issue: number, tracker: Tracker): void {
  const status = tracker.status(issue);
  if (status === undefined || status === 'Backlog') tracker.setReady(issue);
}

export function publish(manifest: Manifest, tracker: Tracker): readonly Published[] {
  const problems = checkManifest(manifest);
  if (problems.length > 0) throw new Error(problems.join('\n'));

  const existing = tracker.subIssues(manifest.feature);
  const numbers = new Map<string, number>();
  const published: Published[] = [];
  for (const task of manifest.tasks) {
    const found = existing.get(task.title);
    const number = found ?? tracker.create(task);
    if (found === undefined) tracker.addSubIssue(manifest.feature, number);
    numbers.set(task.title, number);

    const wanted = task.blockedBy.map((blocker) => resolve(blocker, numbers));
    const present = tracker.blockers(number);
    for (const blocker of wanted) {
      if (!present.has(blocker)) tracker.addBlocker(number, blocker);
    }
    setReadyUnlessStarted(number, tracker);
    published.push({ title: task.title, number, created: found === undefined, blockedBy: wanted });
  }
  setReadyUnlessStarted(manifest.feature, tracker);
  return published;
}

export function verify(manifest: Manifest, published: readonly Published[], tracker: Tracker): readonly string[] {
  const problems: string[] = [];
  const children = tracker.subIssues(manifest.feature);
  for (const task of published) {
    if (children.get(task.title) !== task.number) {
      problems.push(`#${String(task.number)} "${task.title}" is not a sub-issue of #${String(manifest.feature)} under that title.`);
    }
    const present = tracker.blockers(task.number);
    for (const blocker of task.blockedBy) {
      if (!present.has(blocker)) {
        problems.push(`#${String(task.number)} is not recorded as blocked by #${String(blocker)}.`);
      }
    }
  }
  return problems;
}

function gh(args: readonly string[]): string {
  const result = spawnSync('gh', [...args], { encoding: 'utf8', shell: false });
  if (result.status !== 0) throw new Error(`gh ${args.join(' ')}\n${result.stderr}`);
  return result.stdout.trim();
}

const databaseId = (issue: number): string => gh(['api', `repos/{owner}/{repo}/issues/${String(issue)}`, '--jq', '.id']);

const numberIn = (url: string): number => {
  const number = Number(url.slice(url.lastIndexOf('/') + 1));
  if (!Number.isInteger(number)) throw new Error(`No issue number in ${url}`);
  return number;
};

export const githubTracker: Tracker = {
  subIssues: (feature) => {
    const listed = gh([
      'api',
      '--paginate',
      `repos/{owner}/{repo}/issues/${String(feature)}/sub_issues`,
      '--jq',
      '.[] | [.number, .title] | @tsv',
    ]);
    const map = new Map<string, number>();
    for (const line of listed.split('\n').filter((l) => l !== '')) {
      const tab = line.indexOf('\t');
      map.set(line.slice(tab + 1), Number(line.slice(0, tab)));
    }
    return map;
  },
  create: (task) =>
    numberIn(
      gh([
        'issue',
        'create',
        '--label',
        'type:task',
        '--title',
        task.title,
        '--body',
        task.body,
        ...(task.assignee === undefined ? [] : ['--assignee', task.assignee]),
      ]),
    ),
  addSubIssue: (feature, task) => {
    gh(['api', '-X', 'POST', `repos/{owner}/{repo}/issues/${String(feature)}/sub_issues`, '-F', `sub_issue_id=${databaseId(task)}`]);
  },
  blockers: (task) =>
    new Set(
      gh(['api', `repos/{owner}/{repo}/issues/${String(task)}/dependencies/blocked_by`, '--jq', '.[].number'])
        .split('\n')
        .filter((l) => l !== '')
        .map(Number),
    ),
  addBlocker: (task, blocker) => {
    gh([
      'api',
      '-X',
      'POST',
      `repos/{owner}/{repo}/issues/${String(task)}/dependencies/blocked_by`,
      '-F',
      `issue_id=${databaseId(blocker)}`,
    ]);
  },
  status: (issue) => {
    const name = gh([
      'api',
      'graphql',
      '-F',
      `number=${String(issue)}`,
      '-f',
      'query=query($number: Int!) { repository(owner: "kinchi22", name: "credebi") { issue(number: $number) { projectItems(first: 20) { nodes { project { number } fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } } } } } } }',
      '--jq',
      `.data.repository.issue.projectItems.nodes[] | select(.project.number == ${PROJECT.number}) | .fieldValueByName.name // empty`,
    ]);
    return name === '' ? undefined : name;
  },
  setReady: (issue) => {
    const url = gh(['issue', 'view', String(issue), '--json', 'url', '--jq', '.url']);
    const item = gh(['project', 'item-add', PROJECT.number, '--owner', PROJECT.owner, '--url', url, '--format', 'json', '--jq', '.id']);
    gh([
      'project',
      'item-edit',
      '--project-id',
      PROJECT.id,
      '--id',
      item,
      '--field-id',
      PROJECT.statusField,
      '--single-select-option-id',
      PROJECT.ready,
    ]);
  },
};

type ManifestFile = {
  readonly feature: number;
  readonly tasks: readonly {
    readonly title: string;
    readonly body: string;
    readonly blockedBy?: readonly Blocker[];
    readonly assignee?: string;
  }[];
};

export function readManifest(file: string): Manifest {
  const raw = JSON.parse(readFileSync(file, 'utf8')) as ManifestFile;
  const dir = path.dirname(file);
  return {
    feature: raw.feature,
    tasks: raw.tasks.map((task) => ({
      title: task.title,
      body: readFileSync(path.resolve(dir, task.body), 'utf8'),
      blockedBy: task.blockedBy ?? [],
      assignee: task.assignee,
    })),
  };
}

if (import.meta.main) {
  const file = process.argv[2];
  if (file === undefined) {
    console.error('Usage: node tools/publish-tasks.ts <manifest.json>');
    process.exit(2);
  }
  const manifest = readManifest(file);
  const published = publish(manifest, githubTracker);
  for (const task of published) {
    const blockers = task.blockedBy.map((n) => `#${String(n)}`).join(', ');
    console.log(
      `#${String(task.number)} ${task.created ? 'created' : 'kept'}  ${task.title}${blockers === '' ? '' : `  (blocked by ${blockers})`}`,
    );
  }
  const problems = verify(manifest, published, githubTracker);
  if (problems.length > 0) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log(`#${String(manifest.feature)} and every Task above are Ready.`);
}
