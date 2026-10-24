import { ok, type DeploymentIdentity, type DomainError, type Result } from '@repo/contracts';
import { evaluateHealth, type ComponentReport, type HealthReport } from '../domain/status';
import { type HealthProbe } from '../ports/health-probe';

export type GetHealthDependencies = {
  readonly probes: readonly HealthProbe[];
  readonly now: () => Date;
  readonly deployment: DeploymentIdentity;
};

export type HealthReading = HealthReport & { readonly deployment: DeploymentIdentity };

export type GetHealth = () => Promise<Result<HealthReading, DomainError>>;

export function createGetHealth({ probes, now, deployment }: GetHealthDependencies): GetHealth {
  return async (): Promise<Result<HealthReading, DomainError>> => {
    const reports: ComponentReport[] = await Promise.all(
      probes.map(async (probe): Promise<ComponentReport> => {
        const reachable = await probe.check();
        return { name: probe.name, reachable };
      }),
    );

    const health = evaluateHealth(reports, now());
    return health.ok ? ok({ ...health.value, deployment }) : health;
  };
}
