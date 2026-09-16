"use client";

import { Badge } from "@/components/ui/badge";
import { useRealtimeStore } from "@homeguard/state";
import { UserRoundCheck, UsersRound } from "lucide-react";

export function OccupancyIndicator({ propertyId }: { propertyId: string }) {
  const occupancy = useRealtimeStore((state) => state.properties[propertyId]?.occupancy);

  if (!occupancy) {
    return (
      <div className="flex min-h-28 items-center gap-4 rounded-[1.5rem] bg-[#8fdcd0] p-5 text-sm sm:p-6">
        <span className="grid size-10 place-items-center rounded-full bg-[#fffbed]/65">
          <UsersRound className="size-5" />
        </span>
        <div>
          <p className="font-semibold">Occupancy</p>
          <p className="text-xs opacity-55">No live estimate yet</p>
        </div>
        <Badge variant="outline" className="ml-auto border-foreground/20">
          UNKNOWN
        </Badge>
      </div>
    );
  }

  return (
    <div className="flex min-h-28 flex-col justify-center gap-2 rounded-[1.5rem] bg-[#8fdcd0] p-5 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-[#fffbed]/65">
            <UserRoundCheck className="size-5" />
          </span>
          <div>
            <p className="font-semibold">Occupancy</p>
            <p className="text-xs opacity-55">
              Confidence {(occupancy.confidence * 100).toFixed(0)}%
              {occupancy.evidence[0] ? ` · ${occupancy.evidence[0]}` : ""}
            </p>
          </div>
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
