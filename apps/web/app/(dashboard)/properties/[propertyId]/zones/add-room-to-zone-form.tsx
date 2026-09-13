"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { addRoomToZone } from "./actions";

interface FormValues {
  roomId: string;
}

export function AddRoomToZoneForm({
  propertyId,
  zoneId,
  rooms,
}: {
  propertyId: string;
  zoneId: string;
  rooms: Array<{ id: string; name: string }>;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const { control, handleSubmit, reset, watch } = useForm<FormValues>({
    defaultValues: { roomId: rooms[0]?.id ?? "" },
  });

  if (rooms.length === 0) {
    return <p className="text-xs text-neutral-500">All rooms are already in this zone.</p>;
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await addRoomToZone(propertyId, { zoneId, roomId: values.roomId });
      reset({ roomId: rooms[0]?.id ?? "" });
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Something went wrong.");
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <Controller
        control={control}
        name="roomId"
        render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger size="sm" className="w-40">
              <SelectValue>
                {(value: string | null) => rooms.find((room) => room.id === value)?.name}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {rooms.map((room) => (
                <SelectItem key={room.id} value={room.id}>
                  {room.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      <Button type="submit" size="sm" variant="outline" disabled={!watch("roomId")}>
        Add room
      </Button>
      {serverError && <p className="text-xs text-destructive">{serverError}</p>}
    </form>
  );
}
