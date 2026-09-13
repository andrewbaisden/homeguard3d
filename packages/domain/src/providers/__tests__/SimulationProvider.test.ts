import { describe, expect, it, vi } from "vitest";
import { SimulationProvider } from "../SimulationProvider";

describe("SimulationProvider", () => {
  it("emits through its handler with explicit simulation provenance", async () => {
    const handler = vi.fn(async () => undefined);
    const provider = new SimulationProvider();
    provider.onEvent(handler);
    await provider.connect("property-1");
    const result = await provider.sendCommand({
      eventId: "event-1",
      propertyId: "property-1",
      deviceId: "device-1",
      occurredAt: "2026-01-01T00:00:00.000Z",
      type: "door.opened",
      metadata: {},
    });

    expect(result.accepted).toBe(true);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ source: "SIMULATION" }));
  });

  it("rejects a disconnected property", async () => {
    const provider = new SimulationProvider();
    provider.onEvent(async () => undefined);
    expect(
      await provider.sendCommand({
        eventId: "event-1",
        propertyId: "property-1",
        deviceId: "device-1",
        occurredAt: "2026-01-01T00:00:00.000Z",
        type: "door.opened",
        metadata: {},
      }),
    ).toMatchObject({ accepted: false, reason: "PROPERTY_NOT_CONNECTED" });
  });
});
