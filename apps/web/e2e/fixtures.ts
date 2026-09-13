/**
 * Deterministic E2E seed helpers.
 *
 * Full browser journeys require a running stack (Postgres, Redis, web,
 * realtime-service) and an authenticated session. Specs use these
 * selectors/fixtures so assertions stay stable once the seed script
 * has provisioned a property.
 */
export const E2E_FIXTURE = {
  email: process.env.E2E_USER_EMAIL ?? "e2e@homeguard.local",
  password: process.env.E2E_USER_PASSWORD ?? "e2e-password-change-me",
  propertyName: process.env.E2E_PROPERTY_NAME ?? "E2E Demo Home",
} as const;

export const routes = {
  signIn: "/sign-in",
  properties: "/properties",
  property: (propertyId: string) => `/properties/${propertyId}`,
  floorPlan: (propertyId: string) => `/properties/${propertyId}/floor-plan`,
  twin3d: (propertyId: string) => `/properties/${propertyId}/twin-3d`,
  simulation: (propertyId: string) => `/properties/${propertyId}/simulation`,
  alerts: (propertyId: string) => `/properties/${propertyId}/alerts`,
} as const;
