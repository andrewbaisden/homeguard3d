"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { createFloor } from "./actions";

const schema = z.object({
  name: z.string().trim().min(1, "Required"),
  level: z.coerce.number().int(),
});
type FormValues = z.infer<typeof schema>;

export function NewFloorForm({ propertyId }: { propertyId: string }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", level: 0 },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await createFloor(propertyId, values);
      reset();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Something went wrong.");
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="floor-name">Floor name</Label>
        <Input id="floor-name" placeholder="Ground Floor" {...register("name")} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="floor-level">Level</Label>
        <Input id="floor-level" type="number" className="w-20" {...register("level")} />
        {errors.level && <p className="text-xs text-destructive">{errors.level.message}</p>}
      </div>
      <Button type="submit" disabled={isSubmitting}>
        Add floor
      </Button>
      {serverError && <p className="text-xs text-destructive">{serverError}</p>}
    </form>
  );
}
