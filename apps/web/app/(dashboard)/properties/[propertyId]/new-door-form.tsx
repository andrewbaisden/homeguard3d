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
import { WALL_SEGMENTS } from "@/lib/constants";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { createDoor } from "./actions";

const schema = z.object({
  wallSegmentIndex: z.coerce.number().int().min(0).max(3),
  offsetMeters: z.coerce.number().min(0),
  widthMeters: z.coerce.number().positive("Must be positive"),
  isExterior: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

export function NewDoorForm({ propertyId, roomId }: { propertyId: string; roomId: string }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { wallSegmentIndex: 0, offsetMeters: 0, widthMeters: 0.9, isExterior: true },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await createDoor(propertyId, { roomId, ...values });
      reset();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Something went wrong.");
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
      <span className="text-xs font-medium text-neutral-500">Door</span>
      <Controller
        control={control}
        name="wallSegmentIndex"
        render={({ field }) => (
          <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
            <SelectTrigger size="sm" className="w-28">
              <SelectValue placeholder="Wall" />
            </SelectTrigger>
            <SelectContent>
              {WALL_SEGMENTS.map((segment) => (
                <SelectItem key={segment.index} value={String(segment.index)}>
                  {segment.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      <Input
        type="number"
        step="0.1"
        className="w-20"
        placeholder="offset m"
        {...register("offsetMeters")}
      />
      <Input
        type="number"
        step="0.1"
        className="w-20"
        placeholder="width m"
        {...register("widthMeters")}
      />
      <Controller
        control={control}
        name="isExterior"
        render={({ field }) => (
          <Label className="flex items-center gap-1.5 text-xs">
            <Switch size="sm" checked={field.value} onCheckedChange={field.onChange} />
            Exterior
          </Label>
        )}
      />
      <Button type="submit" size="sm" variant="outline" disabled={isSubmitting}>
        Add door
      </Button>
      {(errors.offsetMeters || errors.widthMeters) && (
        <p className="w-full text-xs text-destructive">
          {errors.offsetMeters?.message ?? errors.widthMeters?.message}
        </p>
      )}
      {serverError && <p className="w-full text-xs text-destructive">{serverError}</p>}
    </form>
  );
}
