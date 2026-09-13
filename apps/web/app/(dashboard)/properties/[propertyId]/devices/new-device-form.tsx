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
import { Switch } from "@/components/ui/switch";
import { CAPABILITIES, type CapabilityLiteral, DEVICE_CATEGORIES } from "@/lib/constants";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { createDevice } from "./actions";

const NO_ROOM = "__unassigned__";

const schema = z.object({
  category: z.enum(DEVICE_CATEGORIES),
  label: z.string().trim().min(1, "Required"),
  provider: z.string().trim().min(1, "Required"),
  roomId: z.string(),
});
type FormValues = z.infer<typeof schema>;

export function NewDeviceForm({
  propertyId,
  rooms,
}: {
  propertyId: string;
  rooms: Array<{ id: string; name: string }>;
}) {
  const [capabilities, setCapabilities] = useState<Set<CapabilityLiteral>>(new Set());
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: "CONTACT_SENSOR",
      label: "",
      provider: "SIMULATION",
      roomId: NO_ROOM,
    },
  });

  function toggleCapability(capability: CapabilityLiteral) {
    setCapabilities((prev) => {
      const next = new Set(prev);
      if (next.has(capability)) {
        next.delete(capability);
      } else {
        next.add(capability);
      }
      return next;
    });
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await createDevice(propertyId, {
        category: values.category,
        label: values.label,
        provider: values.provider,
        roomId: values.roomId === NO_ROOM ? undefined : values.roomId,
        capabilities: Array.from(capabilities),
      });
      reset();
      setCapabilities(new Set());
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Something went wrong.");
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="device-label">Label</Label>
          <Input id="device-label" placeholder="Front Door Contact" {...register("label")} />
          {errors.label && <p className="text-xs text-destructive">{errors.label.message}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="device-category">Category</Label>
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="device-category" className="w-44">
                  <SelectValue>{(value: string | null) => value?.replaceAll("_", " ")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {DEVICE_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category.replaceAll("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="device-provider">Provider</Label>
          <Input id="device-provider" className="w-32" {...register("provider")} />
          {errors.provider && <p className="text-xs text-destructive">{errors.provider.message}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="device-room">Room</Label>
          <Controller
            control={control}
            name="roomId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="device-room" className="w-40">
                  <SelectValue>
                    {(value: string | null) =>
                      value && value !== NO_ROOM
                        ? (rooms.find((room) => room.id === value)?.name ?? "Unassigned")
                        : "Unassigned"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ROOM}>Unassigned</SelectItem>
                  {rooms.map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Capabilities</Label>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {CAPABILITIES.map((capability) => (
            <Label key={capability} className="flex items-center gap-1.5 text-sm font-normal">
              <Switch
                size="sm"
                checked={capabilities.has(capability)}
                onCheckedChange={() => toggleCapability(capability)}
              />
              {capability}
            </Label>
          ))}
        </div>
      </div>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting} className="self-start">
        Add device
      </Button>
    </form>
  );
}
