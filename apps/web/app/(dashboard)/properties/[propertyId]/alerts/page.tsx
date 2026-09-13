import { Badge } from "@/components/ui/badge";
import { requireAccess } from "@/server/authz";
import { PropertyAccessError } from "@homeguard/auth";
import { prisma } from "@homeguard/database";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertActions } from "./alert-actions";

export default async function AlertsPage({
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
      alerts: {
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          device: { select: { label: true } },
        },
      },
    },
  });
  if (!property) notFound();

  const triggerIds = property.alerts
    .map((alert) => alert.triggerEventId)
    .filter((id): id is string => Boolean(id));
  const triggerEvents =
    triggerIds.length === 0
      ? []
      : await prisma.event.findMany({
          where: { propertyId, eventId: { in: triggerIds } },
          select: { eventId: true, source: true },
        });
  const sourceByTrigger = new Map(triggerEvents.map((event) => [event.eventId, event.source]));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <Link
          href={`/properties/${property.id}`}
          className="text-sm text-neutral-500 hover:underline"
        >
          ← {property.name}
        </Link>
        <h1 className="text-xl font-semibold">Alerts</h1>
        <p className="text-sm text-neutral-500">
          Security-relevant alerts raised by the ingestion pipeline. Acknowledge or resolve to
          update lifecycle state.
        </p>
      </div>

      {property.alerts.length === 0 ? (
        <p className="text-sm text-neutral-500">No alerts yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {property.alerts.map((alert) => {
            const source = alert.triggerEventId
              ? sourceByTrigger.get(alert.triggerEventId)
              : undefined;
            return (
              <li
                key={alert.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-4"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{alert.title}</p>
                    <Badge
                      variant={
                        alert.severity === "CRITICAL"
                          ? "destructive"
                          : alert.severity === "WARNING"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {alert.severity}
                    </Badge>
                    <Badge variant="outline">{alert.status}</Badge>
                    {source === "SIMULATION" && <Badge variant="secondary">SIMULATED</Badge>}
                  </div>
                  <p className="text-xs text-neutral-500">
                    {alert.device?.label ? `${alert.device.label} · ` : ""}
                    {alert.createdAt.toISOString()}
                  </p>
                </div>
                <AlertActions propertyId={property.id} alertId={alert.id} status={alert.status} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
