import { randomUUID } from "node:crypto";
import type { SecurityEffect } from "@homeguard/domain";

/**
 * In-memory timer scheduling for EXIT_DELAY/ENTRY_DELAY/ALERT_GRACE.
 *
 * KNOWN LIMITATION: these timers live only in this process's memory.
 * If the realtime service restarts while a timer is pending, the
 * property is stuck in EXIT_DELAY/ENTRY_DELAY/ALERT until a new event
 * arrives — there's no recovery. This is a deliberate stand-in for
 * durable BullMQ delayed jobs (see ARCHITECTURE.md section V, Phase
 * 11) rather than a real production timer; it's the simplest thing
 * that proves the state machine's timed transitions end-to-end without
 * pulling BullMQ into the workspace ahead of its scheduled phase.
 */

const activeTimers = new Map<string, NodeJS.Timeout[]>();

const TIMER_EVENT_TYPE = {
  EXIT_DELAY: "security.exit_delay_expired",
  ENTRY_DELAY: "security.entry_delay_expired",
  ALERT_GRACE: "security.alert_grace_expired",
} as const;

export type ReIngestSyntheticEvent = (event: {
  eventId: string;
  propertyId: string;
  source: "SYSTEM";
  occurredAt: string;
  type: string;
  metadata: Record<string, never>;
}) => void;

export function scheduleSecurityEffects(
  propertyId: string,
  effects: SecurityEffect[],
  reIngest: ReIngestSyntheticEvent,
): void {
  for (const effect of effects) {
    if (effect.kind === "CANCEL_TIMERS") {
      cancelTimers(propertyId);
      continue;
    }

    if (effect.kind === "SCHEDULE_TIMER") {
      const type = TIMER_EVENT_TYPE[effect.timer];
      const handle = setTimeout(() => {
        reIngest({
          eventId: `timer:${propertyId}:${effect.timer}:${randomUUID()}`,
          propertyId,
          source: "SYSTEM",
          occurredAt: new Date().toISOString(),
          type,
          metadata: {},
        });
      }, effect.delayMs);

      const list = activeTimers.get(propertyId) ?? [];
      list.push(handle);
      activeTimers.set(propertyId, list);
    }

    // RAISE_ALARM / CLEAR_ALARM carry no scheduling action of their own
    // yet — Phase 11 (Alerts) reacts to the resulting machineState.
  }
}

function cancelTimers(propertyId: string): void {
  const list = activeTimers.get(propertyId);
  if (!list) return;
  for (const handle of list) clearTimeout(handle);
  activeTimers.delete(propertyId);
}
