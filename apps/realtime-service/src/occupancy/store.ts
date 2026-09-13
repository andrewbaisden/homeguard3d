import {
  type EventSource,
  type OccupancyEstimate,
  aggregatePropertyOccupancy,
  estimateOccupancy,
} from "@homeguard/domain";
import { Redis } from "ioredis";

const TTL_SECONDS = 60 * 60 * 6;

export interface PropertyOccupancyView {
  property: OccupancyEstimate;
  rooms: Record<string, OccupancyEstimate>;
}

function redisKey(propertyId: string): string {
  return `homeguard:property:${propertyId}:occupancy`;
}

export class OccupancyStore {
  readonly #redis: Redis;

  constructor(redisUrl: string) {
    this.#redis = new Redis(redisUrl);
  }

  async get(propertyId: string): Promise<PropertyOccupancyView> {
    const raw = await this.#redis.get(redisKey(propertyId));
    const nowMs = Date.now();
    if (!raw) {
      return {
        property: {
          status: "UNKNOWN",
          confidence: 0,
          evidence: ["no evidence"],
          updatedAtMs: nowMs,
          simulated: false,
        },
        rooms: {},
      };
    }
    const rooms = JSON.parse(raw) as Record<string, OccupancyEstimate>;
    return {
      rooms,
      property: aggregatePropertyOccupancy(Object.values(rooms), nowMs),
    };
  }

  async applyDeviceEvidence(
    propertyId: string,
    roomId: string | null | undefined,
    input: {
      kind: "motion_active" | "motion_cleared" | "door_opened" | "door_closed";
      atMs: number;
      source: EventSource;
      deviceId?: string;
    },
  ): Promise<PropertyOccupancyView | null> {
    if (!roomId) return null;
    const current = await this.get(propertyId);
    const previous = current.rooms[roomId];
    const nextRoom = estimateOccupancy(previous, input, input.atMs);
    const rooms = { ...current.rooms, [roomId]: nextRoom };
    await this.#redis.set(redisKey(propertyId), JSON.stringify(rooms), "EX", TTL_SECONDS);
    return {
      rooms,
      property: aggregatePropertyOccupancy(Object.values(rooms), input.atMs),
    };
  }

  async close(): Promise<void> {
    await this.#redis.quit();
  }
}
