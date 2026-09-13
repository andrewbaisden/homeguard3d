// Device provider abstraction — Phase 9 (SimulationProvider first).
//
// interface SmartHomeProvider {
//   readonly providerId: string;
//   connect(propertyId: string): Promise<void>;
//   disconnect(propertyId: string): Promise<void>;
//   onEvent(handler: (event: DomainEventInput) => Promise<void>): void;
//   sendCommand(command: DeviceCommand): Promise<CommandResult>;
// }
//
// SimulationProvider and any future HomeAssistantProvider/MatterProvider
// both implement this and call the SAME registered `handler` that the
// realtime service's ingestion endpoint owns — simulation must never
// bypass validation/idempotency/the reducer. See ARCHITECTURE.md N/O
// and AGENTS.md ("simulation must use the same normalized pipeline").
export {};
