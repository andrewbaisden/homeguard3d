import { z } from "zod";
import { securityModeSchema } from "../events/schema";

export const automationTriggerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("event_type"), type: z.string().min(1) }),
  z.object({
    kind: z.literal("security_machine_state"),
    machineState: z.enum([
      "IDLE_DISARMED",
      "EXIT_DELAY",
      "ARMED",
      "ENTRY_DELAY",
      "ALERT",
      "ALARM",
      "DISARMING",
    ]),
  }),
]);

export const automationConditionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("security_mode"),
    mode: securityModeSchema,
  }),
  z.object({
    kind: z.literal("security_machine_state"),
    machineState: z.enum([
      "IDLE_DISARMED",
      "EXIT_DELAY",
      "ARMED",
      "ENTRY_DELAY",
      "ALERT",
      "ALARM",
      "DISARMING",
    ]),
  }),
  z.object({
    kind: z.literal("device_connectivity"),
    deviceId: z.string().min(1),
    connectivity: z.enum(["ONLINE", "STALE", "OFFLINE", "UNKNOWN"]),
  }),
  z.object({
    kind: z.literal("device_door_state"),
    deviceId: z.string().min(1),
    doorState: z.enum(["OPEN", "CLOSED", "UNKNOWN"]),
  }),
]);

export const automationActionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("SEND_NOTIFICATION"),
    message: z.string().min(1).max(280),
  }),
  z.object({
    kind: z.literal("SET_DEVICE_STATE"),
    deviceId: z.string().min(1),
    eventType: z.enum(["lock.locked", "lock.unlocked", "device.online", "device.offline"]),
  }),
  z.object({
    kind: z.literal("RAISE_ALERT"),
    severity: z.enum(["INFO", "WARNING", "CRITICAL"]),
    title: z.string().min(1).max(120),
  }),
]);

export const automationRuleDefinitionSchema = z.object({
  trigger: automationTriggerSchema,
  conditions: z.array(automationConditionSchema).default([]),
  actions: z.array(automationActionSchema).min(1),
});

export type AutomationTrigger = z.infer<typeof automationTriggerSchema>;
export type AutomationCondition = z.infer<typeof automationConditionSchema>;
export type AutomationAction = z.infer<typeof automationActionSchema>;
export type AutomationRuleDefinition = z.infer<typeof automationRuleDefinitionSchema>;
