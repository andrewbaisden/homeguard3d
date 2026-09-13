import { describe, expect, it, vi } from "vitest";
import { HomeAssistantProvider, mapHaStateToDomainEventInput } from "../HomeAssistantProvider.stub";

describe("mapHaStateToDomainEventInput", () => {
  const entityMap = {
    "binary_sensor.front_door": "device-door",
    "binary_sensor.hallway_motion": "device-motion",
    "lock.front_door": "device-lock",
    "camera.driveway": "device-camera",
  };

  it("maps a contact binary_sensor to door.opened/closed", () => {
    const mapped = mapHaStateToDomainEventInput(
      "property-1",
      {
        entity_id: "binary_sensor.front_door",
        state: "on",
        attributes: { device_class: "door" },
      },
      entityMap,
      "event-1",
    );
    expect(mapped).toMatchObject({
      type: "door.opened",
      deviceId: "device-door",
      propertyId: "property-1",
    });
  });

  it("maps a motion binary_sensor to motion.started/cleared", () => {
    const mapped = mapHaStateToDomainEventInput(
      "property-1",
      {
        entity_id: "binary_sensor.hallway_motion",
        state: "off",
        attributes: { device_class: "motion" },
      },
      entityMap,
      "event-2",
    );
    expect(mapped).toMatchObject({
      type: "motion.cleared",
      deviceId: "device-motion",
    });
  });

  it("maps lock states", () => {
    expect(
      mapHaStateToDomainEventInput(
        "property-1",
        { entity_id: "lock.front_door", state: "locked" },
        entityMap,
        "event-3",
      ),
    ).toMatchObject({ type: "lock.locked", deviceId: "device-lock" });
  });

  it("rejects unmapped entities", () => {
    expect(
      mapHaStateToDomainEventInput(
        "property-1",
        { entity_id: "binary_sensor.unknown", state: "on" },
        entityMap,
        "event-4",
      ),
    ).toEqual({ error: "Unmapped HA entity: binary_sensor.unknown" });
  });
});

describe("HomeAssistantProvider stub", () => {
  it("implements SmartHomeProvider with HOME_ASSISTANT providerId", () => {
    const provider = new HomeAssistantProvider();
    expect(provider.providerId).toBe("HOME_ASSISTANT");
  });

  it("rejects sendCommand with NOT_IMPLEMENTED when connected", async () => {
    const provider = new HomeAssistantProvider();
    provider.onEvent(async () => undefined);
    await provider.connect("property-1");
    expect(
      await provider.sendCommand({
        eventId: "event-1",
        propertyId: "property-1",
        deviceId: "device-1",
        occurredAt: "2026-01-01T00:00:00.000Z",
        type: "lock.locked",
        metadata: {},
      }),
    ).toMatchObject({ accepted: false, reason: "NOT_IMPLEMENTED" });
  });

  it("rejects sendCommand when property is not connected", async () => {
    const provider = new HomeAssistantProvider();
    provider.onEvent(async () => undefined);
    expect(
      await provider.sendCommand({
        eventId: "event-1",
        propertyId: "property-1",
        deviceId: "device-1",
        occurredAt: "2026-01-01T00:00:00.000Z",
        type: "lock.locked",
        metadata: {},
      }),
    ).toMatchObject({ accepted: false, reason: "PROPERTY_NOT_CONNECTED" });
  });

  it("ingestHaState translates HA state and forwards DEVICE-sourced events", async () => {
    const handler = vi.fn(async () => undefined);
    const provider = new HomeAssistantProvider({
      entityMap: { "binary_sensor.front_door": "device-door" },
    });
    provider.onEvent(handler);
    await provider.connect("property-1");

    const result = await provider.ingestHaState(
      "property-1",
      {
        entity_id: "binary_sensor.front_door",
        state: "on",
        attributes: { device_class: "door" },
        last_changed: "2026-01-01T00:00:00.000Z",
      },
      "event-ha-1",
    );

    expect(result).toMatchObject({ accepted: true, eventId: "event-ha-1" });
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "DEVICE",
        type: "door.opened",
        deviceId: "device-door",
        propertyId: "property-1",
      }),
    );
  });

  it("rejects ingestHaState when disconnected", async () => {
    const provider = new HomeAssistantProvider({
      entityMap: { "lock.front_door": "device-lock" },
    });
    provider.onEvent(async () => undefined);
    expect(
      await provider.ingestHaState(
        "property-1",
        { entity_id: "lock.front_door", state: "locked" },
        "event-ha-2",
      ),
    ).toMatchObject({ accepted: false, reason: "PROPERTY_NOT_CONNECTED" });
  });
});
