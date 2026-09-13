"use client";

import { type DomainEvent, domainEventSchema } from "@homeguard/domain";
import { useEffect, useRef, useState } from "react";

export type RealtimeConnectionState = "connecting" | "open" | "closed";

interface TokenResponse {
  token: string;
}

export function usePropertyEventStream({
  propertyId,
  sseBaseUrl,
  onEvent,
}: {
  propertyId: string;
  sseBaseUrl: string;
  onEvent: (event: DomainEvent) => void;
}) {
  const onEventRef = useRef(onEvent);
  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>("connecting");
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    let active = true;
    let source: EventSource | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = async () => {
      if (!active) return;
      setConnectionState("connecting");
      try {
        const response = await fetch(`/api/properties/${propertyId}/realtime-token`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Unable to authorize realtime stream");
        const { token } = (await response.json()) as TokenResponse;
        if (!active) return;

        source = new EventSource(
          `${sseBaseUrl}/realtime/${propertyId}/stream?token=${encodeURIComponent(token)}`,
        );
        source.onopen = () => setConnectionState("open");
        source.onmessage = (message) => {
          let raw: unknown;
          try {
            raw = JSON.parse(message.data);
          } catch {
            return;
          }
          const parsed = domainEventSchema.safeParse(raw);
          if (!parsed.success) return;
          setLastEventAt(parsed.data.occurredAt);
          onEventRef.current(parsed.data);
        };
        source.onerror = () => {
          source?.close();
          setConnectionState("closed");
          if (active) retryTimer = setTimeout(() => void connect(), 2_000);
        };
      } catch {
        setConnectionState("closed");
        if (active) retryTimer = setTimeout(() => void connect(), 2_000);
      }
    };

    void connect();
    return () => {
      active = false;
      source?.close();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [propertyId, sseBaseUrl]);

  return { connectionState, lastEventAt };
}
