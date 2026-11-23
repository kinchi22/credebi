import { spawnSync } from 'node:child_process';

export type GhEnv = Readonly<Record<string, string | undefined>>;

export type GhRunner = (args: readonly string[], env: GhEnv) => string;

export const runGh: GhRunner = (args, env) => {
  const result = spawnSync('gh', [...args], { encoding: 'utf8', shell: false, env: { ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.error) {
    const code = (result.error as NodeJS.ErrnoException).code;
    if (code === 'ENOBUFS') throw new Error('gh wrote more output than the buffer holds');
    throw new Error(`gh could not be started: ${result.error.message}`);
  }
  if (result.signal) throw new Error(`gh was killed by ${result.signal}\n${result.stderr}`);
  if (result.status !== 0) {
    throw new Error(result.stderr === '' ? `gh exited with status ${String(result.status)}` : result.stderr);
  }
  return result.stdout.trim();
};
