import { type Prisma, prisma } from "@homeguard/database";
import type { ReplayState } from "@homeguard/domain";
import { Queue, Worker } from "bullmq";
import type { OccupancyStore } from "../occupancy/store";

export const SNAPSHOT_QUEUE_NAME = "homeguard-snapshots";

export interface SnapshotJobData {
  propertyId: string;
  reason: "interval" | "security_mode_change";
}

export async function capturePropertySnapshot(
  propertyId: string,
  occupancyStore: OccupancyStore | undefined,
): Promise<void> {
  const [devices, security, latestSecurityEvent, occupancy] = await Promise.all([
    prisma.device.findMany({
      where: { propertyId },
      select: {
        id: true,
        connectivity: true,
        doorState: true,
        lockState: true,
        motionState: true,
        cameraState: true,
        batteryPct: true,
        tempC: true,
        humidityPct: true,
        stateUpdatedAt: true,
      },
    }),
    prisma.securityState.findUnique({ where: { propertyId } }),
    prisma.event.findFirst({
      where: { propertyId, type: { startsWith: "security." } },
      orderBy: { occurredAt: "desc" },
      select: { source: true },
    }),
    occupancyStore?.get(propertyId),
  ]);

  const state: ReplayState & { occupancy?: unknown } = {
    devicesById: Object.fromEntries(
      devices.map((device) => [
        device.id,
        {
          id: device.id,
          connectivity: device.connectivity,
          doorState: device.doorState,
          lockState: device.lockState,
          motionState: device.motionState,
          cameraState: device.cameraState,
          batteryPct: device.batteryPct,
          tempC: device.tempC,
          humidityPct: device.humidityPct,
          stateUpdatedAt: device.stateUpdatedAt?.toISOString() ?? null,
          source: null,
        },
      ]),
    ),
    security: {
      machineState: security?.machineState ?? "IDLE_DISARMED",
      mode: security?.mode ?? "DISARMED",
      changedAt: (security?.changedAt ?? new Date(0)).toISOString(),
      source: latestSecurityEvent?.source ?? null,
    },
    ...(occupancy ? { occupancy } : {}),
  };

  await prisma.snapshot.create({
    data: {
      propertyId,
      takenAt: new Date(),
      state: state as unknown as Prisma.InputJsonValue,
    },
  });
}

export function createSnapshotQueue(redisUrl: string) {
  return new Queue<SnapshotJobData>(SNAPSHOT_QUEUE_NAME, {
    connection: { url: redisUrl },
  });
}

export async function scheduleSnapshotJobs(queue: Queue<SnapshotJobData>): Promise<void> {
  await queue.add(
    "interval",
    { propertyId: "*", reason: "interval" },
    {
      repeat: { every: 15 * 60 * 1000 },
      jobId: "snapshot-interval",
      removeOnComplete: 20,
      removeOnFail: 20,
    },
  );
}

export async function enqueueSecurityModeSnapshot(
  queue: Queue<SnapshotJobData>,
  propertyId: string,
): Promise<void> {
  await queue.add(
    "security_mode_change",
    { propertyId, reason: "security_mode_change" },
    { removeOnComplete: 50, removeOnFail: 20 },
  );
}

export function startSnapshotWorker(
  redisUrl: string,
  occupancyStore: OccupancyStore | undefined,
): Worker {
  return new Worker<SnapshotJobData>(
    SNAPSHOT_QUEUE_NAME,
    async (job) => {
      if (job.data.propertyId === "*") {
        const properties = await prisma.property.findMany({ select: { id: true } });
        for (const property of properties) {
          await capturePropertySnapshot(property.id, occupancyStore);
        }
        return;
      }
      await capturePropertySnapshot(job.data.propertyId, occupancyStore);
    },
    { connection: { url: redisUrl } },
  );
}
