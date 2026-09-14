"use client";

import { usePropertyEventStream } from "@/lib/use-property-event-stream";
import type { StructuralModel } from "@homeguard/domain";
import { type OperationalSnapshot, structuralQueryKey, useRealtimeStore } from "@homeguard/state";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useEffect, useLayoutEffect, useState } from "react";

function RealtimeBridge({
  propertyId,
  initial,
  sseBaseUrl,
}: {
  propertyId: string;
  initial: OperationalSnapshot;
  sseBaseUrl: string;
}) {
  const hydrate = useRealtimeStore((state) => state.hydrate);
  const applyEvent = useRealtimeStore((state) => state.applyEvent);
  const setConnection = useRealtimeStore((state) => state.setConnection);

  useEffect(() => hydrate(propertyId, initial), [hydrate, initial, propertyId]);

  const { connectionState } = usePropertyEventStream({
    propertyId,
    sseBaseUrl,
    onEvent: (event) => applyEvent(propertyId, event),
  });

  useEffect(() => {
    setConnection(propertyId, connectionState);
    if (connectionState !== "open") return;
    let active = true;
    void fetch(`/api/properties/${propertyId}/state`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to reconcile property state");
        return response.json() as Promise<OperationalSnapshot>;
      })
      .then((snapshot) => {
        if (active) hydrate(propertyId, snapshot);
      })
      .catch(() => {
        // The live stream remains useful even if this best-effort reconnect
        // reconciliation fails; the connection indicator still reflects SSE.
      });
    return () => {
      active = false;
    };
  }, [connectionState, hydrate, propertyId, setConnection]);

  return null;
}

export function PropertyStateProvider({
  propertyId,
  structure,
  initial,
  sseBaseUrl,
  children,
}: {
  propertyId: string;
  structure: StructuralModel;
  initial: OperationalSnapshot;
  sseBaseUrl: string;
  children: ReactNode;
}) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } },
    });
    // Seed in the initializer so the first child render already sees structure
    // (avoids Missing structural model races with dynamic 3D imports).
    client.setQueryData(structuralQueryKey(propertyId), structure);
    return client;
  });

  useLayoutEffect(() => {
    queryClient.setQueryData(structuralQueryKey(propertyId), structure);
  }, [propertyId, queryClient, structure]);

  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeBridge propertyId={propertyId} initial={initial} sseBaseUrl={sseBaseUrl} />
      {children}
    </QueryClientProvider>
  );
}
