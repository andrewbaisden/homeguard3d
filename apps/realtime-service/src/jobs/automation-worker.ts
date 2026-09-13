import { randomUUID } from "node:crypto";
import type { AutomationJobDescriptor } from "@homeguard/domain";
import { Queue, Worker } from "bullmq";
import { ingestEvent } from "../ingestion/handler";
import type { RealtimeBus } from "../realtime/pubsub";

export const AUTOMATION_QUEUE_NAME = "homeguard-automation-actions";

export function createAutomationQueue(redisUrl: string) {
  return new Queue<AutomationJobDescriptor>(AUTOMATION_QUEUE_NAME, {
    connection: { url: redisUrl },
  });
}

export async function enqueueAutomationJobs(
  queue: Queue<AutomationJobDescriptor>,
  jobs: AutomationJobDescriptor[],
): Promise<void> {
  if (jobs.length === 0) return;
  await queue.addBulk(
    jobs.map((job, jobIndex) => ({
      name: job.action.kind,
      data: job,
      opts: {
        jobId: `${job.ruleId}:${job.triggerEventId}:${job.action.kind}:${jobIndex}`,
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    })),
  );
}

export function startAutomationWorker(redisUrl: string, bus: RealtimeBus): Worker {
  return new Worker<AutomationJobDescriptor>(
    AUTOMATION_QUEUE_NAME,
    async (job) => {
      const data = job.data;
      switch (data.action.kind) {
        case "SEND_NOTIFICATION": {
          console.info("[automation] notification", {
            propertyId: data.propertyId,
            ruleId: data.ruleId,
            message: data.action.message,
          });
          return;
        }
        case "RAISE_ALERT": {
          const alertId = randomUUID();
          await ingestEvent(
            {
              eventId: `automation:${data.ruleId}:${data.triggerEventId}:raise`,
              propertyId: data.propertyId,
              source: "AUTOMATION",
              occurredAt: new Date().toISOString(),
              type: "alert.raised",
              metadata: {
                alertId,
                severity: data.action.severity,
                title: data.action.title,
              },
            },
            bus,
          );
          return;
        }
        case "SET_DEVICE_STATE": {
          await ingestEvent(
            {
              eventId: `automation:${data.ruleId}:${data.triggerEventId}:device`,
              propertyId: data.propertyId,
              deviceId: data.action.deviceId,
              source: "AUTOMATION",
              occurredAt: new Date().toISOString(),
              type: data.action.eventType,
              metadata: {},
            },
            bus,
          );
          return;
        }
        default: {
          const _exhaustive: never = data.action;
          throw new Error(`Unhandled automation action ${JSON.stringify(_exhaustive)}`);
        }
      }
    },
    { connection: { url: redisUrl } },
  );
}
