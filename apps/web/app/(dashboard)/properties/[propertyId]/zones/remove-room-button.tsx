"use client";

import { Button } from "@/components/ui/button";
import { useTransition } from "react";
import { removeRoomFromZone } from "./actions";

export function RemoveRoomButton({
  propertyId,
  zoneId,
  roomId,
}: {
  propertyId: string;
  zoneId: string;
  roomId: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      disabled={isPending}
      onClick={() => startTransition(() => removeRoomFromZone(propertyId, { zoneId, roomId }))}
    >
      Remove
    </Button>
  );
}
