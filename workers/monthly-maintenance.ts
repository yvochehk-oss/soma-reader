export interface MaintenanceEnv {
  CRON_SECRET: string;
  MAINTENANCE_TARGET?: string;
}

type ScheduledEvent = { cron: string; scheduledTime: number; noRetry(): void };
type ExecutionContext = { waitUntil(promise: Promise<unknown>): void };

const maintenanceWorker = {
  async scheduled(_event: ScheduledEvent, env: MaintenanceEnv, ctx: ExecutionContext) {
    const target = env.MAINTENANCE_TARGET ?? "https://read.20140128.xyz/api/internal/monthly-report";
    ctx.waitUntil(fetch(target, { method: "POST", headers: { "x-soma-cron-secret": env.CRON_SECRET } }));
  },
};

export default maintenanceWorker;
