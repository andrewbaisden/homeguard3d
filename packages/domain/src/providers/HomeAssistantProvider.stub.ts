import { domainEventSchema } from "../events/schema";
import type {
  CommandResult,
  DomainEventInput,
  ProviderEventHandler,
  SmartHomeProvider,
} from "./SmartHomeProvider";

/**
 * Stub Home Assistant provider — proves the Phase-9 SmartHomeProvider
 * boundary without shipping real HA websocket/REST connectivity
 * (ARCHITECTURE.md Phase 15, ADR-014).
 *
 * HA entity vocabulary is translated only at this adapter edge via
 * `mapHaStateToDomainEventInput`. Domain code never speaks HA natively.
 */

export interface HaEntityState {
  entity_id: string;
  state: string;
  last_changed?: string;
  attributes?: Record<string, unknown>;
}

export interface HomeAssistantProviderOptions {
  /** Maps HA entity_id → HomeGuard deviceId. Required for inbound state mapping. */
  entityMap?: Record<string, string>;
}

/** Translate a Home Assistant entity state into a DomainEventInput (no source). */
export function mapHaStateToDomainEventInput(
  propertyId: string,
  haState: HaEntityState,
  entityMap: Record<string, string>,
  eventId: string,
): DomainEventInput | { error: string } {
  const deviceId = entityMap[haState.entity_id];
  if (!deviceId) {
    return { error: `Unmapped HA entity: ${haState.entity_id}` };
  }

  const domain = haState.entity_id.split(".")[0];
  const occurredAt = haState.last_changed ?? new Date().toISOString();

  if (domain === "binary_sensor") {
    const deviceClass = haState.attributes?.device_class;
    if (deviceClass === "motion" || haState.entity_id.includes("motion")) {
      return {
        eventId,
        propertyId,
        deviceId,
        occurredAt,
        type: haState.state === "on" ? "motion.started" : "motion.cleared",
        metadata: {},
      };
    }
    return {
      eventId,
      propertyId,
      deviceId,
      occurredAt,
      type: haState.state === "on" ? "door.opened" : "door.closed",
      metadata: {},
    };
  }

  if (domain === "lock") {
    if (haState.state === "locked") {
      return { eventId, propertyId, deviceId, occurredAt, type: "lock.locked", metadata: {} };
    }
    if (haState.state === "unlocked") {
      return { eventId, propertyId, deviceId, occurredAt, type: "lock.unlocked", metadata: {} };
    }
    if (haState.state === "jammed") {
      return { eventId, propertyId, deviceId, occurredAt, type: "lock.jammed", metadata: {} };
    }
    return { error: `Unsupported lock state: ${haState.state}` };
  }

  if (domain === "camera") {
    if (haState.state === "idle" || haState.state === "streaming") {
      return { eventId, propertyId, deviceId, occurredAt, type: "camera.online", metadata: {} };
    }
    if (haState.state === "unavailable") {
      return { eventId, propertyId, deviceId, occurredAt, type: "camera.offline", metadata: {} };
    }
    return { error: `Unsupported camera state: ${haState.state}` };
  }

  return { error: `Unsupported HA domain: ${domain ?? "(empty)"}` };
}

/**
 * Stub Home Assistant provider — interface-complete, no real HA I/O.
 * Demonstrates the translation boundary without shipping connectivity.
 */
export class HomeAssistantProvider implements SmartHomeProvider {
  readonly providerId = "HOME_ASSISTANT";
  readonly #connectedProperties = new Set<string>();
  readonly #entityMap: Record<string, string>;
  #handler: ProviderEventHandler | undefined;

  constructor(options: HomeAssistantProviderOptions = {}) {
    this.#entityMap = options.entityMap ?? {};
  }

  async connect(propertyId: string): Promise<void> {
    // Stub: no websocket/REST session to Home Assistant is opened.
    this.#connectedProperties.add(propertyId);
  }

  async disconnect(propertyId: string): Promise<void> {
    this.#connectedProperties.delete(propertyId);
  }

  onEvent(handler: ProviderEventHandler): void {
    this.#handler = handler;
  }

  /**
   * Accepts a domain command. Real HA would translate this to a service
   * call; the stub rejects with NOT_IMPLEMENTED so no HA I/O ships.
   */
  async sendCommand(command: DomainEventInput): Promise<CommandResult> {
    if (!this.#connectedProperties.has(command.propertyId)) {
      return { accepted: false, eventId: command.eventId, reason: "PROPERTY_NOT_CONNECTED" };
    }
    if (!this.#handler) {
      return { accepted: false, eventId: command.eventId, reason: "NO_EVENT_HANDLER" };
    }

    const parsed = domainEventSchema.safeParse({ ...command, source: "DEVICE" });
    if (!parsed.success) {
      return { accepted: false, eventId: command.eventId, reason: "INVALID_EVENT" };
    }

    return {
      accepted: false,
      eventId: command.eventId,
      reason: "NOT_IMPLEMENTED",
    };
  }

  /**
   * Stub inbound path: map an HA state payload and forward to the
   * registered handler. Used in tests to prove the translation boundary;
   * no live HA websocket subscription is established.
   */
  async ingestHaState(
    propertyId: string,
    haState: HaEntityState,
    eventId: string,
  ): Promise<CommandResult> {
    if (!this.#connectedProperties.has(propertyId)) {
      return { accepted: false, eventId, reason: "PROPERTY_NOT_CONNECTED" };
    }
    if (!this.#handler) {
      return { accepted: false, eventId, reason: "NO_EVENT_HANDLER" };
    }

    const mapped = mapHaStateToDomainEventInput(propertyId, haState, this.#entityMap, eventId);
    if ("error" in mapped) {
      return { accepted: false, eventId, reason: mapped.error };
    }

    const parsed = domainEventSchema.safeParse({ ...mapped, source: "DEVICE" });
    if (!parsed.success) {
      return { accepted: false, eventId, reason: "INVALID_EVENT" };
    }

    await this.#handler(parsed.data);
    return { accepted: true, eventId };
  }
}
