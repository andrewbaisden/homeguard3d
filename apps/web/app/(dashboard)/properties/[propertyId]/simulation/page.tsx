import { requireAccess } from "@/server/authz";
import { PropertyAccessError } from "@homeguard/auth";
import { prisma } from "@homeguard/database";
import type { SimulationStatus } from "@homeguard/domain";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSimulationStatus } from "./actions";
import { SimulationControls } from "./simulation-controls";

export default async function SimulationPage({
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
    select: { id: true, name: true },
  });
  if (!property) notFound();

  let initial: SimulationStatus;
  try {
    initial = await getSimulationStatus(propertyId);
  } catch {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <Link
          href={`/properties/${property.id}`}
          className="text-sm text-neutral-500 hover:underline"
        >
          ← {property.name}
        </Link>
        <h1 className="text-xl font-semibold">Simulation</h1>
        <p className="text-sm text-destructive">
          Could not reach the realtime service. Start it locally, then reload this page.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div>
        <Link
          href={`/properties/${property.id}`}
          className="text-sm text-neutral-500 hover:underline"
        >
          ← {property.name}
        </Link>
        <h1 className="text-xl font-semibold">Simulation</h1>
        <p className="text-sm text-neutral-500">
          Deterministic household stories. Every emitted event is tagged SIMULATION and enters the
          same ingestion pipeline as physical devices.
        </p>
      </div>

      <SimulationControls propertyId={property.id} initial={initial} />
    </div>
  );
}
