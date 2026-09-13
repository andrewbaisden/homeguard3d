import type { DomainEvent } from "../events/schema";
import type { SecurityMachineState, SecurityMode } from "../security/stateMachine";
import type {
  AutomationAction,
  AutomationCondition,
  AutomationRuleDefinition,
  AutomationTrigger,
} from "./schema";

export interface AutomationDeviceSnapshot {
  connectivity: "ONLINE" | "STALE" | "OFFLINE" | "UNKNOWN";
  doorState: "OPEN" | "CLOSED" | "UNKNOWN" | null;
}

export interface AutomationEvaluationState {
  security: {
    machineState: SecurityMachineState;
    mode: SecurityMode;
  };
  devices: Record<string, AutomationDeviceSnapshot>;
}

export interface AutomationRuleInput {
  id: string;
  name: string;
  enabled: boolean;
  definition: AutomationRuleDefinition;
}

export interface AutomationJobDescriptor {
  ruleId: string;
  ruleName: string;
  action: AutomationAction;
  triggerEventId: string;
  propertyId: string;
}

function triggerMatches(
  trigger: AutomationTrigger,
  event: DomainEvent,
  previous: AutomationEvaluationState,
  next: AutomationEvaluationState,
): boolean {
  switch (trigger.kind) {
    case "event_type":
      return event.type === trigger.type;
    case "security_machine_state":
      return (
        next.security.machineState === trigger.machineState &&
        previous.security.machineState !== trigger.machineState
      );
    default: {
      const _exhaustive: never = trigger;
      return _exhaustive;
    }
  }
}

function conditionSatisfied(
  condition: AutomationCondition,
  state: AutomationEvaluationState,
): boolean {
  switch (condition.kind) {
    case "security_mode":
      return state.security.mode === condition.mode;
    case "security_machine_state":
      return state.security.machineState === condition.machineState;
    case "device_connectivity": {
      const device = state.devices[condition.deviceId];
      return device?.connectivity === condition.connectivity;
    }
    case "device_door_state": {
      const device = state.devices[condition.deviceId];
      return device?.doorState === condition.doorState;
    }
    default: {
      const _exhaustive: never = condition;
      return _exhaustive;
    }
  }
}

/**
 * Pure automation evaluation — returns BullMQ job descriptors only.
 * Action execution stays out of this function (ARCHITECTURE.md §P).
 */
export function evaluateAutomationRules(
  event: DomainEvent,
  previous: AutomationEvaluationState,
  next: AutomationEvaluationState,
  rules: AutomationRuleInput[],
): AutomationJobDescriptor[] {
  const jobs: AutomationJobDescriptor[] = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (!triggerMatches(rule.definition.trigger, event, previous, next)) continue;
    if (!rule.definition.conditions.every((condition) => conditionSatisfied(condition, next))) {
      continue;
    }
    for (const action of rule.definition.actions) {
      jobs.push({
        ruleId: rule.id,
        ruleName: rule.name,
        action,
        triggerEventId: event.eventId,
        propertyId: event.propertyId,
      });
    }
  }

  return jobs;
}
