"use client";

import type { StructuralModel } from "@homeguard/three-adapter";
import dynamic from "next/dynamic";
import { Component, type ErrorInfo, type ReactNode, useEffect, useState } from "react";
import { type FloorData, FloorPlanCanvas } from "../floor-plan/floor-plan-canvas";
import type { TwinDeviceState } from "./types";

const Scene3D = dynamic(() => import("./scene-3d").then((module) => module.Scene3D), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[32rem] items-center justify-center rounded-lg border bg-muted/30 text-sm text-neutral-500">
      Loading 3D twin…
    </div>
  ),
});

function FloorPlanFallback({
  reason,
  propertyId,
  floors,
  sseBaseUrl,
  canEdit,
}: {
  reason: string;
  propertyId: string;
  floors: FloorData[];
  sseBaseUrl: string;
  canEdit: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
        {reason} The live 2D floor plan is shown instead.
      </p>
      <FloorPlanCanvas
        propertyId={propertyId}
        floors={floors}
        sseBaseUrl={sseBaseUrl}
        canEdit={canEdit}
      />
    </div>
  );
}

interface BoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface BoundaryState {
  failed: boolean;
}

class SceneErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[twin-3d] rendering failed", error, info.componentStack);
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function Twin3DLoader({
  propertyId,
  structuralModel,
  initialDevices,
  floors,
  sseBaseUrl,
  canEdit,
}: {
  propertyId: string;
  structuralModel: StructuralModel;
  initialDevices: TwinDeviceState[];
  floors: FloorData[];
  sseBaseUrl: string;
  canEdit: boolean;
}) {
  const [webglAvailable, setWebglAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    setWebglAvailable(supportsWebGL());
  }, []);

  if (webglAvailable == null) {
    return (
      <div className="flex min-h-[32rem] items-center justify-center rounded-lg border bg-muted/30 text-sm text-neutral-500">
        Checking 3D support…
      </div>
    );
  }

  const fallback = (
    <FloorPlanFallback
      reason="3D rendering is unavailable in this browser."
      propertyId={propertyId}
      floors={floors}
      sseBaseUrl={sseBaseUrl}
      canEdit={canEdit}
    />
  );

  if (!webglAvailable) return fallback;

  return (
    <SceneErrorBoundary fallback={fallback}>
      <Scene3D
        propertyId={propertyId}
        structuralModel={structuralModel}
        initialDevices={initialDevices}
        sseBaseUrl={sseBaseUrl}
      />
    </SceneErrorBoundary>
  );
}
