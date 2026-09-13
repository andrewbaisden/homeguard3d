import { z } from "zod";
import type { DomainEvent } from "../events/schema";
import type { SecurityMachineState, SecurityMode } from "../security/stateMachine";

export const alertSeveritySchema = z.enum(["INFO", "WARNING", "CRITICAL"]);
export type AlertSeverity = z.infer<typeof alertSeveritySchema>;

export interface AlertEvaluationState {
  security: {
    machineState: SecurityMachineState;
    mode: SecurityMode;
  };
}

export interface AlertProposal {
  severity: AlertSeverity;
  title: string;
  deviceId?: string;
  roomId?: string;
}

/**
 * Pure built-in alert rules — run after operational state is updated
 * in the same ingestion transaction (ARCHITECTURE.md section P).
 */
export function evaluateAlertRules(
  event: DomainEvent,
  previous: AlertEvaluationState,
  next: AlertEvaluationState,
): AlertProposal[] {
  const proposals: AlertProposal[] = [];

  if (next.security.machineState === "ALARM" && previous.security.machineState !== "ALARM") {
    proposals.push({
      severity: "CRITICAL",
      title: "Security alarm",
      ...(event.type === "security.sensor_triggered" && "deviceId" in event
        ? { deviceId: event.deviceId }
        : {}),
    });
  }

  if (event.type === "device.offline") {
    proposals.push({
      severity: "WARNING",
      title: "Device went offline",
      deviceId: event.deviceId,
      ...(event.roomId ? { roomId: event.roomId } : {}),
    });
  }

  if (event.type === "lock.jammed") {
    proposals.push({
      severity: "WARNING",
      title: "Lock jammed",
      deviceId: event.deviceId,
      ...(event.roomId ? { roomId: event.roomId } : {}),
    });
  }

  return proposals;
}
