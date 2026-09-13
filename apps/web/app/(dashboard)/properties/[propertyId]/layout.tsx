import { requireAccess } from "@/server/authz";
import { loadOperationalSnapshot, loadStructuralModel } from "@/server/property-state";
import { PropertyAccessError } from "@homeguard/auth";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PropertyStateProvider } from "./property-state-provider";

const REALTIME_SSE_BASE_URL = process.env.NEXT_PUBLIC_REALTIME_SSE_URL ?? "http://localhost:8080";

export default async function PropertyLayout({
  params,
  children,
}: {
  params: Promise<{ propertyId: string }>;
  children: ReactNode;
}) {
  const { propertyId } = await params;
  try {
    await requireAccess(propertyId, "VIEWER");
  } catch (error) {
    if (error instanceof PropertyAccessError) notFound();
    throw error;
  }

  const [structure, initial] = await Promise.all([
    loadStructuralModel(propertyId),
    loadOperationalSnapshot(propertyId),
  ]);
  if (!structure) notFound();

  return (
    <PropertyStateProvider
      propertyId={propertyId}
      structure={structure}
      initial={initial}
      sseBaseUrl={REALTIME_SSE_BASE_URL}
    >
      {children}
    </PropertyStateProvider>
  );
}
