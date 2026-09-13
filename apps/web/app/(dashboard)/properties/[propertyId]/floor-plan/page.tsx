import { requireAccess } from "@/server/authz";
import { PropertyAccessError } from "@homeguard/auth";
import { notFound } from "next/navigation";
import { FloorPlanView } from "./floor-plan-view";

export default async function FloorPlanPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  let canEdit = false;
  try {
    const access = await requireAccess(propertyId, "VIEWER");
    canEdit = access.role === "ADMIN" || access.role === "OWNER";
  } catch (error) {
    if (error instanceof PropertyAccessError) notFound();
    throw error;
  }
  return <FloorPlanView propertyId={propertyId} canEdit={canEdit} />;
}
