import { getEnv } from "@/lib/env";
import { requireAccess } from "@/server/authz";
import { PropertyAccessError } from "@homeguard/auth";
import { createRealtimeToken } from "@homeguard/auth/realtime-token";
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

  const token = createRealtimeToken(propertyId, getEnv().FLY_SERVICE_SECRET);
  return NextResponse.json(
    { token },
    { headers: { "cache-control": "private, no-store, max-age=0" } },
  );
}
