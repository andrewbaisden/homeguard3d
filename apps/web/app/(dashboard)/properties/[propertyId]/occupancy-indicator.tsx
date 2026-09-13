"use client";

import { Badge } from "@/components/ui/badge";
import { useRealtimeStore } from "@homeguard/state";

export function OccupancyIndicator({ propertyId }: { propertyId: string }) {
  const occupancy = useRealtimeStore((state) => state.properties[propertyId]?.occupancy);

  if (!occupancy) {
    return <div className="rounded-lg border p-4 text-sm text-neutral-500">Occupancy: unknown</div>;
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Occupancy</p>
          <p className="text-xs text-neutral-500">
            Confidence {(occupancy.confidence * 100).toFixed(0)}%
            {occupancy.evidence[0] ? ` · ${occupancy.evidence[0]}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {occupancy.simulated && <Badge variant="secondary">SIMULATED</Badge>}
          <Badge variant={occupancy.status === "OCCUPIED" ? "destructive" : "outline"}>
            {occupancy.status}
          </Badge>
        </div>
      </div>
    </div>
  );
}
