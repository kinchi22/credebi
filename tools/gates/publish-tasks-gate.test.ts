import { describe, expect, it } from 'vitest';
import { checkManifest, publish, verify, type Manifest, type TaskPlan, type Tracker } from '../publish-tasks';

type Issue = { readonly title: string; readonly body: string; readonly assignee: string | undefined };

function memoryTracker(feature: number, firstNumber: number) {
  const issues = new Map<number, Issue>();
  const children = new Map<number, number[]>([[feature, []]]);
  const blockedBy = new Map<number, Set<number>>();
  const ready = new Set<number>();
  const statuses = new Map<number, string>();
  let next = firstNumber;
  const tracker: Tracker = {
    subIssues: (parent) =>
      new Map((children.get(parent) ?? []).map((n) => [issues.get(n)?.title ?? '', n] as const)),
    create: (task) => {
      const number = next++;
      issues.set(number, { title: task.title, body: task.body, assignee: task.assignee });
      return number;
    },
    addSubIssue: (parent, task) => {
      children.set(parent, [...(children.get(parent) ?? []), task]);
    },
    blockers: (task) => new Set(blockedBy.get(task)),
    addBlocker: (task, blocker) => {
      blockedBy.set(task, new Set([...(blockedBy.get(task) ?? []), blocker]));
    },
    status: (issue) => statuses.get(issue),
    setReady: (issue) => {
      ready.add(issue);
      statuses.set(issue, 'Ready');
    },
  };
  return { tracker, issues, children, blockedBy, ready, statuses };
}

const task = (title: string, blockedBy: TaskPlan['blockedBy'] = [], assignee?: string): TaskPlan => ({
  title,
  body: `Body of ${title}`,
  blockedBy,
  assignee,
});

const CHAIN: Manifest = {
  feature: 100,
  tasks: [
    task('Specs'),
    task('Layout', ['Specs']),
    task('Motion', ['Layout', 42]),
    task('UAT', ['Motion'], 'owner'),
  ],
};

describe('publish', () => {
  it('creates every Task in order as a sub-issue of the Feature, each with its own title and body', () => {
    const memory = memoryTracker(100, 200);
    publish(CHAIN, memory.tracker);

    expect(memory.children.get(100)).toEqual([200, 201, 202, 203]);
    expect([...memory.issues.values()].map((i) => [i.title, i.body])).toEqual([
      ['Specs', 'Body of Specs'],
      ['Layout', 'Body of Layout'],
      ['Motion', 'Body of Motion'],
      ['UAT', 'Body of UAT'],
    ]);
    expect(memory.issues.get(203)?.assignee).toBe('owner');
  });

  it('records each blocker named by title as the issue that title was given, and one named by number as that issue', () => {
    const memory = memoryTracker(100, 200);
    publish(CHAIN, memory.tracker);

    expect([...(memory.blockedBy.get(200) ?? [])]).toEqual([]);
    expect([...(memory.blockedBy.get(201) ?? [])]).toEqual([200]);
    expect([...(memory.blockedBy.get(202) ?? [])]).toEqual([201, 42]);
    expect([...(memory.blockedBy.get(203) ?? [])]).toEqual([202]);
  });

  it('sets every Task and the Feature Ready', () => {
    const memory = memoryTracker(100, 200);
    publish(CHAIN, memory.tracker);

    expect([...memory.ready].sort()).toEqual([100, 200, 201, 202, 203]);
  });

  it('keeps a Task already under the Feature by its title on a second run, creating nothing twice', () => {
    const memory = memoryTracker(100, 200);
    publish({ feature: 100, tasks: CHAIN.tasks.slice(0, 2) }, memory.tracker);
    const second = publish(CHAIN, memory.tracker);

    expect(memory.children.get(100)).toEqual([200, 201, 202, 203]);
    expect(second.map((t) => [t.number, t.created])).toEqual([
      [200, false],
      [201, false],
      [202, true],
      [203, true],
    ]);
    expect([...(memory.blockedBy.get(201) ?? [])]).toEqual([200]);
  });

  it.each(['Ready', 'In Progress', 'In Review', 'Done'])('leaves a kept Task and the Feature in %s as they are on a rerun', (status) => {
    const memory = memoryTracker(100, 200);
    publish(CHAIN, memory.tracker);
    for (const issue of [100, 200, 201, 202, 203]) memory.statuses.set(issue, status);
    publish(CHAIN, memory.tracker);

    expect([...memory.statuses.values()]).toEqual([status, status, status, status, status]);
  });

  it('sets a kept Task and the Feature in Backlog, and one not on the board, to Ready', () => {
    const memory = memoryTracker(100, 200);
    publish({ feature: 100, tasks: CHAIN.tasks.slice(0, 2) }, memory.tracker);
    memory.statuses.set(100, 'Backlog');
    memory.statuses.set(200, 'Backlog');
    memory.statuses.delete(201);
    publish(CHAIN, memory.tracker);

    expect([100, 200, 201, 202, 203].map((n) => memory.statuses.get(n))).toEqual(['Ready', 'Ready', 'Ready', 'Ready', 'Ready']);
  });

  it('refuses a manifest whose blocker is not a Task listed before it, creating nothing', () => {
    const memory = memoryTracker(100, 200);
    const backwards: Manifest = { feature: 100, tasks: [task('Layout', ['Specs']), task('Specs')] };

    expect(() => publish(backwards, memory.tracker)).toThrow(/"Layout" is blocked by "Specs"/);
    expect(memory.issues.size).toBe(0);
  });
});

describe('checkManifest', () => {
  it('names a title listed twice and an empty title', () => {
    expect(checkManifest({ feature: 1, tasks: [task('A'), task('A'), task(' ')] })).toEqual([
      '"A" is listed twice.',
      'A Task has an empty title.',
    ]);
  });

  it('accepts a chain whose every blocker comes earlier', () => {
    expect(checkManifest(CHAIN)).toEqual([]);
  });
});

describe('verify', () => {
  it('finds nothing wrong after a publish', () => {
    const memory = memoryTracker(100, 200);
    const published = publish(CHAIN, memory.tracker);

    expect(verify(CHAIN, published, memory.tracker)).toEqual([]);
  });

  it('names a Task missing from the Feature and a blocker that was not recorded', () => {
    const memory = memoryTracker(100, 200);
    const published = publish(CHAIN, memory.tracker);
    memory.children.set(100, [200, 201, 203]);
    memory.blockedBy.set(203, new Set());

    expect(verify(CHAIN, published, memory.tracker)).toEqual([
      '#202 "Motion" is not a sub-issue of #100 under that title.',
      '#203 is not recorded as blocked by #202.',
    ]);
  });
});
