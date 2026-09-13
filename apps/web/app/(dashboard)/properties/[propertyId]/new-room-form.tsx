"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROOM_KINDS } from "@/lib/constants";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { createRoom } from "./actions";

const schema = z.object({
  name: z.string().trim().min(1, "Required"),
  kind: z.enum(ROOM_KINDS),
  x: z.coerce.number(),
  y: z.coerce.number(),
  width: z.coerce.number().positive("Must be positive"),
  height: z.coerce.number().positive("Must be positive"),
});
type FormValues = z.infer<typeof schema>;

export function NewRoomForm({ propertyId, floorId }: { propertyId: string; floorId: string }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", kind: "OTHER", x: 0, y: 0, width: 4, height: 4 },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await createRoom(propertyId, { floorId, ...values });
      reset();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Something went wrong.");
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-lg border border-dashed p-3">
      <p className="text-xs font-medium text-neutral-500">Add room</p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${floorId}-room-name`}>Name</Label>
          <Input id={`${floorId}-room-name`} placeholder="Kitchen" {...register("name")} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${floorId}-room-kind`}>Type</Label>
          <Controller
            control={control}
            name="kind"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id={`${floorId}-room-kind`}>
                  <SelectValue placeholder="Select type">
                    {(value: string | null) => value?.replaceAll("_", " ")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ROOM_KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {kind.replaceAll("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${floorId}-room-x`}>X (m)</Label>
          <Input
            id={`${floorId}-room-x`}
            type="number"
            step="0.1"
            className="w-20"
            {...register("x")}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${floorId}-room-y`}>Y (m)</Label>
          <Input
            id={`${floorId}-room-y`}
            type="number"
            step="0.1"
            className="w-20"
            {...register("y")}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${floorId}-room-width`}>Width (m)</Label>
          <Input
            id={`${floorId}-room-width`}
            type="number"
            step="0.1"
            className="w-20"
            {...register("width")}
          />
          {errors.width && <p className="text-xs text-destructive">{errors.width.message}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${floorId}-room-height`}>Height (m)</Label>
          <Input
            id={`${floorId}-room-height`}
            type="number"
            step="0.1"
            className="w-20"
            {...register("height")}
          />
          {errors.height && <p className="text-xs text-destructive">{errors.height.message}</p>}
        </div>
        <Button type="submit" size="sm" disabled={isSubmitting}>
          Add room
        </Button>
      </div>
      {serverError && <p className="text-xs text-destructive">{serverError}</p>}
    </form>
  );
}
