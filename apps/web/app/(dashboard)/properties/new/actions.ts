"use server";

import { getCurrentUserId } from "@/lib/session";
import { prisma } from "@homeguard/database";
import { z } from "zod";

const createPropertySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  timezone: z.string().trim().min(1, "Timezone is required").max(64),
});

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;

/**
 * Creates a property and makes the calling user its OWNER. This is the
 * one mutation in the app that does not need requirePropertyAccess —
 * there is no property to be scoped to yet.
 */
export async function createProperty(input: CreatePropertyInput): Promise<{ id: string }> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("You must be signed in to create a property.");
  }

  const { name, timezone } = createPropertySchema.parse(input);

  const property = await prisma.property.create({
    data: {
      name,
      timezone,
      memberships: { create: { userId, role: "OWNER" } },
      securityState: { create: {} },
    },
    select: { id: true },
  });

  return property;
}
