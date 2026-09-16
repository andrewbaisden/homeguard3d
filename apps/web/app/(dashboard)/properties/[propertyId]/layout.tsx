import { requireAccess } from "@/server/authz";
import { loadOperationalSnapshot, loadStructuralModel } from "@/server/property-state";
import { PropertyAccessError } from "@homeguard/auth";
import {
  Bell,
  Boxes,
  Cpu,
  History,
  House,
  Map as MapIcon,
  Shield,
  Sparkles,
  Workflow,
} from "lucide-react";
import Link from "next/link";
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

  const navigation = [
    { label: "Overview", href: `/properties/${propertyId}`, icon: House },
    { label: "Floor plan", href: `/properties/${propertyId}/floor-plan`, icon: MapIcon },
    { label: "3D twin", href: `/properties/${propertyId}/twin-3d`, icon: Boxes },
    { label: "Devices", href: `/properties/${propertyId}/devices`, icon: Cpu },
    { label: "Zones", href: `/properties/${propertyId}/zones`, icon: Shield },
    { label: "Alerts", href: `/properties/${propertyId}/alerts`, icon: Bell },
    { label: "Automations", href: `/properties/${propertyId}/automations`, icon: Workflow },
    { label: "Simulation", href: `/properties/${propertyId}/simulation`, icon: Sparkles },
    { label: "Replay", href: `/properties/${propertyId}/replay`, icon: History },
  ];

  return (
    <PropertyStateProvider
      propertyId={propertyId}
      structure={structure}
      initial={initial}
      sseBaseUrl={REALTIME_SSE_BASE_URL}
    >
      <div className="page-shell">
        <div className="mb-8 flex flex-col gap-5 border-b border-foreground/10 pb-6">
          <div className="flex items-end justify-between gap-5">
            <div>
              <Link
                href="/properties"
                className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
              >
                All properties
              </Link>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">
                {structure.propertyName}
              </h1>
            </div>
            <span className="hidden items-center gap-2 rounded-full bg-[#d8ff5f] px-3 py-1.5 text-xs font-bold sm:inline-flex">
              <span className="size-2 rounded-full bg-[#153f3a]" /> Unified model
            </span>
          </div>
          <nav
            className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1"
            aria-label="Property navigation"
          >
            {navigation.map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-foreground/10 bg-white/35 px-3 py-2 text-xs font-semibold transition-all hover:-translate-y-0.5 hover:bg-white"
              >
                <Icon className="size-3.5" /> {label}
              </Link>
            ))}
          </nav>
        </div>
        {children}
      </div>
    </PropertyStateProvider>
  );
}
