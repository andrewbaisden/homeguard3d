import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAccess } from "@/server/authz";
import { PropertyAccessError } from "@homeguard/auth";
import { prisma } from "@homeguard/database";
import { automationRuleDefinitionSchema } from "@homeguard/domain";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NewAutomationForm } from "./new-automation-form";
import { AutomationRuleControls } from "./rule-controls";

export default async function AutomationsPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  try {
    await requireAccess(propertyId, "VIEWER");
  } catch (error) {
    if (error instanceof PropertyAccessError) notFound();
    throw error;
  }

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      name: true,
      automationRules: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!property) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <Link
          href={`/properties/${property.id}`}
          className="text-sm text-neutral-500 hover:underline"
        >
          ← {property.name}
        </Link>
        <h1 className="text-xl font-semibold">Automations</h1>
        <p className="text-sm text-neutral-500">
          Structured trigger → conditions → action rules. Evaluation is pure; actions run through
          BullMQ.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">New rule</CardTitle>
        </CardHeader>
        <CardContent>
          <NewAutomationForm propertyId={property.id} />
        </CardContent>
      </Card>

      {property.automationRules.length === 0 ? (
        <p className="text-sm text-neutral-500">No automation rules yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {property.automationRules.map((rule) => {
            const definition = automationRuleDefinitionSchema.safeParse(rule.definition);
            return (
              <li
                key={rule.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-4"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{rule.name}</p>
                    <Badge variant={rule.enabled ? "secondary" : "outline"}>
                      {rule.enabled ? "enabled" : "disabled"}
                    </Badge>
                  </div>
                  {definition.success ? (
                    <p className="text-xs text-neutral-500">
                      When {JSON.stringify(definition.data.trigger)} →{" "}
                      {definition.data.actions.map((action) => action.kind).join(", ")}
                    </p>
                  ) : (
                    <p className="text-xs text-destructive">Invalid stored definition</p>
                  )}
                </div>
                <AutomationRuleControls
                  propertyId={property.id}
                  ruleId={rule.id}
                  enabled={rule.enabled}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
