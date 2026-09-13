import { expect, test } from "@playwright/test";
import { E2E_FIXTURE, routes } from "./fixtures";

test.describe("intrusion journey", () => {
  test.skip(!process.env.E2E_PROPERTY_ID, "Set E2E_PROPERTY_ID after seeding a fixture property");

  test("intrusion simulation raises a SIMULATED alert path", async ({ page }) => {
    const propertyId = process.env.E2E_PROPERTY_ID!;
    await page.goto(routes.signIn);
    await page.getByLabel(/email/i).fill(E2E_FIXTURE.email);
    await page.getByLabel(/password/i).fill(E2E_FIXTURE.password);
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.goto(routes.simulation(propertyId));
    // Select Intrusion scenario if the select is free.
    const scenario = page.getByLabel(/scenario/i);
    if (await scenario.isVisible()) {
      await scenario.click();
      await page.getByRole("option", { name: /Intrusion/i }).click();
    }

    await page.getByRole("button", { name: /^Start$/i }).click();
    await expect(page.getByText(/SIMULATED/i).first()).toBeVisible({ timeout: 15_000 });

    await page.goto(routes.property(propertyId));
    await expect(page.getByText(/ALARM|Entry delay|Armed|Alert/i).first()).toBeVisible({
      timeout: 20_000,
    });

    await page.goto(routes.alerts(propertyId));
    await expect(page.getByRole("heading", { name: /alerts/i })).toBeVisible();
  });
});
