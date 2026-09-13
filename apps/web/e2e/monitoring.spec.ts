import { expect, test } from "@playwright/test";
import { E2E_FIXTURE, routes } from "./fixtures";

/**
 * Monitoring journey (TESTING.md).
 * Requires a seeded authenticated environment — skipped unless E2E_PROPERTY_ID is set.
 */
test.describe("monitoring journey", () => {
  test.skip(!process.env.E2E_PROPERTY_ID, "Set E2E_PROPERTY_ID after seeding a fixture property");

  test("views security, 2D, and 3D for the seeded property", async ({ page }) => {
    const propertyId = process.env.E2E_PROPERTY_ID!;
    await page.goto(routes.signIn);
    await page.getByLabel(/email/i).fill(E2E_FIXTURE.email);
    await page.getByLabel(/password/i).fill(E2E_FIXTURE.password);
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.goto(routes.property(propertyId));
    await expect(page.getByText(/security/i).first()).toBeVisible();
    await expect(page.getByText(/occupancy/i).first()).toBeVisible();

    await page.goto(routes.floorPlan(propertyId));
    await expect(page.locator("svg").first()).toBeVisible();

    await page.goto(routes.twin3d(propertyId));
    await expect(page.getByText(/3d|twin|webgl|floor/i).first()).toBeVisible();
  });
});
