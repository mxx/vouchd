/**
 * The smallest browser contract for vouchd: the built SPA renders its shell,
 * exposes the community input, and remembers a relay URL without a backend.
 */
import { expect, test } from "@playwright/test";

test("renders the read-only community shell", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("vouchd");
  await expect(page.getByRole("heading", { name: "vouchd" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Community" })).toBeVisible();
  await expect(page.getByText("No signing extension: read-only.")).toBeVisible();
});

test("persists the relay URL entered by the user", async ({ page }) => {
  await page.goto("/");

  const relay = page.getByLabel("Relay URL");
  await relay.fill("wss://relay.example.test");
  const connect = page.getByRole("button", { name: "Connect" });
  await expect(connect).toBeEnabled();
  await connect.click();
  await page.reload();

  await expect(page.getByLabel("Relay URL")).toHaveValue("wss://relay.example.test");
});
