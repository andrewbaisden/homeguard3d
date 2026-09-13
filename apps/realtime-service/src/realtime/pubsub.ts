import { EventEmitter } from "node:events";
import { Redis } from "ioredis";

export interface RealtimeBus {
  publish(propertyId: string, payload: unknown): Promise<void>;
  /** Returns an unsubscribe function. */
  subscribe(propertyId: string, onMessage: (payload: unknown) => void): () => void;
  close(): Promise<void>;
}

function channelFor(propertyId: string): string {
  return `homeguard:property:${propertyId}:events`;
}

/**
 * Redis-backed pub/sub fan-out — see ARCHITECTURE.md section I. Not
 * durable by design: a client that misses a message while disconnected
 * is expected to reconcile via a snapshot/state refetch (Phase 8), not
 * rely on this bus for delivery guarantees.
 *
 * Uses one shared subscriber connection (ioredis requires a dedicated
 * connection once it's in subscribe mode) fanning out to per-property
 * listeners via an in-process EventEmitter, rather than one Redis
 * connection per SSE client.
 */
export function createRedisRealtimeBus(redisUrl: string): RealtimeBus {
  const publisher = new Redis(redisUrl);
  const subscriber = new Redis(redisUrl);
  const emitter = new EventEmitter();
  emitter.setMaxListeners(0);

  subscriber.on("message", (channel: string, message: string) => {
    emitter.emit(channel, message);
  });

  return {
    async publish(propertyId, payload) {
      await publisher.publish(channelFor(propertyId), JSON.stringify(payload));
    },

    subscribe(propertyId, onMessage) {
      const channel = channelFor(propertyId);
      const listener = (message: string) => {
        onMessage(JSON.parse(message));
      };

      emitter.on(channel, listener);
      if (emitter.listenerCount(channel) === 1) {
        void subscriber.subscribe(channel);
      }

      return () => {
        emitter.off(channel, listener);
        if (emitter.listenerCount(channel) === 0) {
          void subscriber.unsubscribe(channel);
        }
      };
    },

    async close() {
      await Promise.all([publisher.quit(), subscriber.quit()]);
    },
  };
}
