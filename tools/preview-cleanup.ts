import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

export type Deployment = {
  readonly id: string;
  readonly projectId: string;
  readonly target: string | null;
  readonly created: number;
};

export type Page = {
  readonly deployments: readonly Deployment[];
  readonly next: number | null;
};

export type Snapshot = {
  readonly projectId: string;
  readonly teamId: string;
  readonly capturedAt: number;
  readonly pages: number;
  readonly previewIds: readonly string[];
  readonly productionIds: readonly string[];
};

export async function captureSnapshot(
  projectId: string,
  teamId: string,
  capturedAt: number,
  list: (until: number) => Promise<Page>,
): Promise<Snapshot> {
  const previewIds = new Set<string>();
  const productionIds = new Set<string>();
  let until: number | null = capturedAt;
  let pages = 0;
  while (until !== null) {
    const page = await list(until);
    pages += 1;
    for (const deployment of page.deployments) {
      if (JSON.stringify(deployment).includes('...[truncated]')) throw new Error('Inventory contains a truncated deployment');
      if (deployment.projectId !== projectId || deployment.created > capturedAt) continue;
      if (deployment.target === null || deployment.target === 'preview') previewIds.add(deployment.id);
      if (deployment.target === 'production') productionIds.add(deployment.id);
    }
    if (page.next !== null && page.next >= until) throw new Error('Inventory pagination did not advance');
    until = page.next;
  }
  return { projectId, teamId, capturedAt, pages, previewIds: [...previewIds], productionIds: [...productionIds] };
}

export async function cleanSnapshot(
  snapshot: Snapshot,
  read: (id: string) => Promise<Deployment | undefined>,
  remove: (id: string) => Promise<void>,
): Promise<{ removed: string[]; failures: { id: string; reason: string }[]; missingProduction: string[] }> {
  const removed: string[] = [];
  const failures: { id: string; reason: string }[] = [];
  const baseline: string[] = [];
  for (const id of snapshot.productionIds) {
    const deployment = await read(id);
    if (deployment?.projectId !== snapshot.projectId || deployment.target !== 'production') baseline.push(id);
  }
  if (baseline.length > 0) return { removed, failures, missingProduction: baseline };
  for (const id of snapshot.previewIds) {
    try {
      const deployment = await read(id);
      if (deployment !== undefined) {
        if (deployment.projectId !== snapshot.projectId || deployment.created > snapshot.capturedAt ||
            (deployment.target !== null && deployment.target !== 'preview')) {
          throw new Error('Captured deployment is outside the Preview cleanup scope');
        }
        await remove(id);
      }
      if (await read(id) !== undefined) throw new Error('Captured Preview remains after deletion');
      removed.push(id);
    } catch (error) {
      failures.push({ id, reason: error instanceof Error ? error.message : String(error) });
    }
  }
  const missingProduction: string[] = [];
  for (const id of snapshot.productionIds) {
    const deployment = await read(id);
    if (deployment?.projectId !== snapshot.projectId || deployment.target !== 'production') missingProduction.push(id);
  }
  return { removed, failures, missingProduction };
}

export function verifySnapshot(snapshot: Snapshot, inventory: readonly Deployment[]): {
  remainingPreviewIds: string[];
  missingProductionIds: string[];
} {
  const current = new Map(inventory.filter((deployment) => deployment.projectId === snapshot.projectId).map((deployment) => [deployment.id, deployment]));
  return {
    remainingPreviewIds: snapshot.previewIds.filter((id) => current.has(id)),
    missingProductionIds: snapshot.productionIds.filter((id) => current.get(id)?.target !== 'production'),
  };
}

export async function executeSnapshot(
  snapshot: Snapshot,
  request: (endpoint: string, method: 'GET' | 'DELETE') => Promise<unknown>,
): Promise<{ removed: string[]; failures: { id: string; reason: string }[]; missingProduction: string[]; remainingPreviewIds: string[]; missingProductionIds: string[] }> {
  const inventory = async (): Promise<Deployment[]> => {
    const all: Deployment[] = [];
    let until: number | null = Date.now();
    while (until !== null) {
      const query = new URLSearchParams({ projectId: snapshot.projectId, teamId: snapshot.teamId, limit: '100', until: String(until) });
      const page = await request(`/v7/deployments?${query.toString()}`, 'GET') as {
        deployments: { uid: string; projectId?: string; target: string | null; created: number }[];
        pagination: { next: number | null };
      };
      for (const row of page.deployments) {
        if (typeof row.uid !== 'string' || typeof row.created !== 'number' ||
            (row.target !== null && typeof row.target !== 'string') || JSON.stringify(row).includes('...[truncated]')) {
          throw new Error('Inventory contains an invalid deployment');
        }
        all.push({ id: row.uid, projectId: row.projectId ?? snapshot.projectId, target: row.target, created: row.created });
      }
      if (page.pagination.next !== null && page.pagination.next >= until) throw new Error('Inventory pagination did not advance');
      until = page.pagination.next;
    }
    return all;
  };
  const before = new Map((await inventory()).map((row) => [row.id, row]));
  const outcome = await cleanSnapshot(snapshot, (id) => Promise.resolve(before.get(id)), async (id) => {
    const response = await request(`/v13/deployments/${encodeURIComponent(id)}?teamId=${encodeURIComponent(snapshot.teamId)}`, 'DELETE') as { uid?: string; state?: string };
    if (response.uid !== id || response.state !== 'DELETED') throw new Error('Deletion response does not confirm the captured Preview');
    before.delete(id);
  });
  return { ...outcome, ...verifySnapshot(snapshot, await inventory()) };
}

if (import.meta.main) {
  try {
    const filename = process.argv[2];
    if (filename === undefined) throw new Error('Pass the frozen snapshot JSON file and an output report path');
    const manifest = readFileSync(filename);
    if (createHash('sha256').update(manifest).digest('hex') !== '32068bc2e35362c198ee6611fc0c19ff664b93a9daadd350719125cafb526a9b') {
      throw new Error('The manifest does not match the frozen cleanup snapshot');
    }
    const snapshot = JSON.parse(manifest.toString('utf8')) as Snapshot;
    const command = (args: readonly string[]): string => {
      const result = spawnSync('vercel', [...args, '--scope', snapshot.teamId, '--non-interactive'], { encoding: 'utf8', shell: false });
      if (result.status !== 0) throw new Error(result.stderr || result.stdout || result.error?.message || 'Vercel command failed');
      return result.stdout;
    };
    const project = JSON.parse(command(['project', 'inspect', 'credebi', '--format', 'json'])) as { id?: string; accountId?: string };
    if (project.id !== snapshot.projectId || project.accountId !== snapshot.teamId) throw new Error('Vercel project or team does not match the frozen snapshot');
    const report = await executeSnapshot(snapshot, (endpoint, method) => {
      if (method === 'DELETE') {
        const id = endpoint.split('/').at(-1)?.split('?')[0] ?? '';
        if (!snapshot.previewIds.includes(id) || !/^dpl_[A-Za-z0-9]+$/.test(id)) throw new Error('Deployment is not in the frozen Preview list');
        command(['remove', id, '--yes']);
        return Promise.resolve({ uid: id, state: 'DELETED' });
      }
      return Promise.resolve(JSON.parse(command(['api', endpoint, '--raw'])) as unknown);
    });
    const output = JSON.stringify(report, null, 2) + '\n';
    if (process.argv[3] !== undefined) writeFileSync(process.argv[3], output);
    console.log(output);
    if (report.failures.length > 0 || report.missingProduction.length > 0 || report.remainingPreviewIds.length > 0 || report.missingProductionIds.length > 0) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
