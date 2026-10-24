import { z } from 'zod';

export const healthStateSchema = z.enum(['healthy', 'degraded']);

export const healthComponentSchema = z.object({
  name: z.string().min(1),
  reachable: z.boolean(),
});

export const deploymentIdentitySchema = z.object({
  id: z.string().min(1).nullable(),
  commit: z.string().min(1).nullable(),
  url: z.string().min(1).nullable(),
});

export const healthStatusSchema = z.object({
  status: healthStateSchema,
  components: z.array(healthComponentSchema),
  checkedAt: z.iso.datetime(),
  deployment: deploymentIdentitySchema,
});

export type HealthState = z.infer<typeof healthStateSchema>;
export type HealthComponent = z.infer<typeof healthComponentSchema>;
export type DeploymentIdentity = z.infer<typeof deploymentIdentitySchema>;
export type HealthStatus = z.infer<typeof healthStatusSchema>;

export function toHealthStatus(report: {
  readonly status: HealthState;
  readonly components: readonly HealthComponent[];
  readonly checkedAt: Date;
  readonly deployment: DeploymentIdentity;
}): HealthStatus {
  return {
    status: report.status,
    components: report.components.map((component) => ({
      name: component.name,
      reachable: component.reachable,
    })),
    checkedAt: report.checkedAt.toISOString(),
    deployment: {
      id: report.deployment.id,
      commit: report.deployment.commit,
      url: report.deployment.url,
    },
  };
}
