import type { DomainEvent } from "../events/schema";

export type DomainEventInput = DomainEvent extends infer Event
  ? Event extends DomainEvent
    ? Omit<Event, "source">
    : never
  : never;

export interface CommandResult {
  accepted: boolean;
  eventId: string;
  reason?: string;
}

export type ProviderEventHandler = (event: DomainEvent) => Promise<void>;

/** The one integration boundary used by simulation and future real providers. */
export interface SmartHomeProvider {
  readonly providerId: string;
  connect(propertyId: string): Promise<void>;
  disconnect(propertyId: string): Promise<void>;
  onEvent(handler: ProviderEventHandler): void;
  sendCommand(command: DomainEventInput): Promise<CommandResult>;
}
