import { expect, test } from "@playwright/test";
import { E2E_FIXTURE, routes } from "./fixtures";

test.describe("simulation journey", () => {
  test.skip(!process.env.E2E_PROPERTY_ID, "Set E2E_PROPERTY_ID after seeding a fixture property");

  test("starts, pauses, resumes, and resets Normal Evening", async ({ page }) => {
    const propertyId = process.env.E2E_PROPERTY_ID!;
    await page.goto(routes.signIn);
    await page.getByLabel(/email/i).fill(E2E_FIXTURE.email);
    await page.getByLabel(/password/i).fill(E2E_FIXTURE.password);
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.goto(routes.simulation(propertyId));
    await expect(page.getByRole("heading", { name: /simulation/i })).toBeVisible();
    await expect(page.getByText(/Normal Evening/i).first()).toBeVisible();

    await page.getByRole("button", { name: /^Start$/i }).click();
    await expect(page.getByText(/RUNNING|SIMULATED/i).first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: /^Pause$/i }).click();
    await expect(page.getByText(/PAUSED/i).first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: /^Resume$/i }).click();
    await page.getByRole("button", { name: /^Reset$/i }).click();
  });
});
