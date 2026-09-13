"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { createZone } from "./actions";

const SECURITY_MODES = ["HOME", "NIGHT", "AWAY"] as const;
type SecurityModeLiteral = (typeof SECURITY_MODES)[number];

const schema = z.object({ name: z.string().trim().min(1, "Required") });
type FormValues = z.infer<typeof schema>;

export function NewZoneForm({ propertyId }: { propertyId: string }) {
  const [activeModes, setActiveModes] = useState<Set<SecurityModeLiteral>>(new Set(["AWAY"]));
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: "" } });

  function toggleMode(mode: SecurityModeLiteral) {
    setActiveModes((prev) => {
      const next = new Set(prev);
      if (next.has(mode)) {
        next.delete(mode);
      } else {
        next.add(mode);
      }
      return next;
    });
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await createZone(propertyId, { name: values.name, activeModes: Array.from(activeModes) });
      reset();
      setActiveModes(new Set(["AWAY"]));
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Something went wrong.");
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="zone-name">Zone name</Label>
          <Input id="zone-name" placeholder="Perimeter" {...register("name")} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Active for</Label>
          <div className="flex gap-3">
            {SECURITY_MODES.map((mode) => (
              <Label key={mode} className="flex items-center gap-1.5 text-sm font-normal">
                <Switch
                  size="sm"
                  checked={activeModes.has(mode)}
                  onCheckedChange={() => toggleMode(mode)}
                />
                {mode}
              </Label>
            ))}
          </div>
        </div>
        <Button type="submit" disabled={isSubmitting}>
          Add zone
        </Button>
      </div>
      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
    </form>
  );
}
