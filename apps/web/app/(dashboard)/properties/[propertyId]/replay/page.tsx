import { requireAccess } from "@/server/authz";
import { PropertyAccessError } from "@homeguard/auth";
import { prisma } from "@homeguard/database";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReplayControls } from "./replay-controls";

export default async function ReplayPage({
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
      _count: { select: { snapshots: true } },
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
        <h1 className="text-xl font-semibold">Historical replay</h1>
        <p className="text-sm text-neutral-500">
          Loads the latest snapshot at or before the chosen time, then folds forward through the
          same reducers used for live ingestion. {property._count.snapshots} snapshot(s) stored.
        </p>
      </div>

      <ReplayControls propertyId={property.id} />
    </div>
  );
}
