"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { createProperty } from "./actions";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  timezone: z.string().trim().min(1, "Timezone is required"),
});
type FormValues = z.infer<typeof schema>;

export function NewPropertyForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const property = await createProperty(values);
      router.push(`/properties/${property.id}`);
      router.refresh();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Something went wrong.");
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Property name</Label>
        <Input id="name" placeholder="123 Maple Street" {...register("name")} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="timezone">Timezone</Label>
        <Input id="timezone" placeholder="Europe/London" {...register("timezone")} />
        {errors.timezone && <p className="text-xs text-destructive">{errors.timezone.message}</p>}
      </div>
      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <Button type="submit" size="lg" disabled={isSubmitting} className="mt-2 w-full">
        {isSubmitting ? "Creating property…" : "Create property"}
      </Button>
    </form>
  );
}
