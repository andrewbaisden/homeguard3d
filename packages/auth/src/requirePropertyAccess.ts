import { type Role, prisma } from "@homeguard/database";

const ROLE_RANK: Record<Role, number> = {
  VIEWER: 0,
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

export class PropertyAccessError extends Error {
  constructor(reason: "UNAUTHENTICATED" | "FORBIDDEN") {
    super(`Property access denied: ${reason}`);
    this.name = "PropertyAccessError";
  }
}

/**
 * The single authorization gate every property-scoped server action /
 * route handler must call first — see AGENTS.md and ARCHITECTURE.md
 * section R. Never inline `session.user.id === ...` checks; extend
 * this helper instead so every scope check goes through one audited
 * path.
 *
 * Phase 1 stub: signature and role-ranking logic are final, but this
 * is not yet wired to a real request/session context (Phase 2 adds
 * the Next.js server-action call sites).
 */
export async function requirePropertyAccess(
  userId: string | undefined,
  propertyId: string,
  minRole: Role = "VIEWER",
): Promise<{ userId: string; role: Role }> {
  if (!userId) {
    throw new PropertyAccessError("UNAUTHENTICATED");
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_propertyId: { userId, propertyId } },
  });

  if (!membership || ROLE_RANK[membership.role] < ROLE_RANK[minRole]) {
    throw new PropertyAccessError("FORBIDDEN");
  }

  return { userId, role: membership.role };
}
