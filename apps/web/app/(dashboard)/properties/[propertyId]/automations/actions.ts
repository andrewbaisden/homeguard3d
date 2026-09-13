"use server";

import { requireAccess } from "@/server/authz";
import { prisma } from "@homeguard/database";
import { type AutomationRuleDefinition, automationRuleDefinitionSchema } from "@homeguard/domain";
import { revalidatePath } from "next/cache";

const AUTOMATION_MIN_ROLE = "MEMBER" as const;

export async function createAutomationRule(
  propertyId: string,
  input: { name: string; definition: AutomationRuleDefinition },
): Promise<void> {
  await requireAccess(propertyId, AUTOMATION_MIN_ROLE);
  const definition = automationRuleDefinitionSchema.parse(input.definition);
  const name = input.name.trim();
  if (!name) throw new Error("Name is required.");

  await prisma.automationRule.create({
    data: {
      propertyId,
      name,
      enabled: true,
      definition: definition as object,
    },
  });

  revalidatePath(`/properties/${propertyId}/automations`);
}

export async function setAutomationRuleEnabled(
  propertyId: string,
  ruleId: string,
  enabled: boolean,
): Promise<void> {
  await requireAccess(propertyId, AUTOMATION_MIN_ROLE);
  const updated = await prisma.automationRule.updateMany({
    where: { id: ruleId, propertyId },
    data: { enabled },
  });
  if (updated.count === 0) throw new Error("Automation rule not found.");
  revalidatePath(`/properties/${propertyId}/automations`);
}

export async function deleteAutomationRule(propertyId: string, ruleId: string): Promise<void> {
  await requireAccess(propertyId, AUTOMATION_MIN_ROLE);
  const deleted = await prisma.automationRule.deleteMany({
    where: { id: ruleId, propertyId },
  });
  if (deleted.count === 0) throw new Error("Automation rule not found.");
  revalidatePath(`/properties/${propertyId}/automations`);
}
