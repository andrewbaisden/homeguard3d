import { requireAccess } from "@/server/authz";
import { loadOperationalSnapshot } from "@/server/property-state";
import { PropertyAccessError } from "@homeguard/auth";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ propertyId: string }> },
) {
  const { propertyId } = await params;
  try {
    await requireAccess(propertyId, "VIEWER");
  } catch (error) {
    if (error instanceof PropertyAccessError) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    throw error;
  }
  return NextResponse.json(await loadOperationalSnapshot(propertyId), {
    headers: { "cache-control": "private, no-store, max-age=0" },
  });
}
