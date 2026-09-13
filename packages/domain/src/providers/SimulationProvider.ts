import { domainEventSchema } from "../events/schema";
import type {
  CommandResult,
  DomainEventInput,
  ProviderEventHandler,
  SmartHomeProvider,
} from "./SmartHomeProvider";

/** Provider-edge adapter that always applies explicit SIMULATION provenance. */
export class SimulationProvider implements SmartHomeProvider {
  readonly providerId = "SIMULATION";
  readonly #connectedProperties = new Set<string>();
  #handler: ProviderEventHandler | undefined;

  async connect(propertyId: string): Promise<void> {
    this.#connectedProperties.add(propertyId);
  }

  async disconnect(propertyId: string): Promise<void> {
    this.#connectedProperties.delete(propertyId);
  }

  onEvent(handler: ProviderEventHandler): void {
    this.#handler = handler;
  }

  async sendCommand(command: DomainEventInput): Promise<CommandResult> {
    if (!this.#connectedProperties.has(command.propertyId)) {
      return { accepted: false, eventId: command.eventId, reason: "PROPERTY_NOT_CONNECTED" };
    }
    if (!this.#handler) {
      return { accepted: false, eventId: command.eventId, reason: "NO_EVENT_HANDLER" };
    }

    const parsed = domainEventSchema.safeParse({ ...command, source: "SIMULATION" });
    if (!parsed.success) {
      return { accepted: false, eventId: command.eventId, reason: "INVALID_EVENT" };
    }
    await this.#handler(parsed.data);
    return { accepted: true, eventId: command.eventId };
  }
}
