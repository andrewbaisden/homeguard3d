"use client";

import { usePropertyStructure } from "@homeguard/state";
import Link from "next/link";
import { Twin3DLoader } from "./twin-3d-loader";

export function Twin3DView({ propertyId, canEdit }: { propertyId: string; canEdit: boolean }) {
  const structure = usePropertyStructure(propertyId);
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div>
        <Link
          href={`/properties/${propertyId}`}
          className="text-sm text-neutral-500 hover:underline"
        >
          ← {structure.propertyName}
        </Link>
        <h1 className="text-xl font-semibold">3D digital twin</h1>
      </div>
      {structure.floors.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No floors yet — add one from the property page first.
        </p>
      ) : (
        <Twin3DLoader propertyId={propertyId} canEdit={canEdit} />
      )}
    </div>
  );
}
