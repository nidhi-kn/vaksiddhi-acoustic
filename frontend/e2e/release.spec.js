import { test, expect } from "@playwright/test";
import { resolve } from "node:path";

test("upload rejects incomplete responses, reports errors and retries real inference", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/analyze");
  await page.locator("input[type=file]").setInputFiles(resolve("../test_audio/spoof_1.wav"));
  const button = page.getByRole("button", { name: "Analyze recording" });
  await expect(button).toBeEnabled();
  await page.route("**/api/analyze", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.fulfill({ json: { acoustic: { prediction: "below_threshold", spoof_score: .01, bonafide_score: .99, threshold: .05530281 } } });
  });
  await button.click();
  await expect(page.getByRole("button", { name: "Processing audio..." })).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("unsupported prediction contract");
  await expect(page.locator(".result")).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vak-history-v1") || "[]").length)).toBe(0);
  await page.unroute("**/api/analyze");
  await page.route("**/api/analyze", (route) => route.fulfill({ status: 503, json: { detail: "Model unavailable. Retry after startup." } }));
  await button.click();
  await expect(page.getByRole("alert")).toContainText("Model unavailable");
  await expect(button).toBeEnabled();
  await page.unroute("**/api/analyze");
  await button.click();
  await expect(page.locator(".result .verdict-title")).toHaveText("POTENTIAL SPOOF DETECTED", { timeout: 30000 });
  await expect(page.locator(".score-grid")).toContainText("0.11987715");
  await page.goto("/history");
  await page.reload();
  await expect(page.getByRole("row").filter({ hasText: "spoof_1.wav" })).toContainText("Potential Spoof Detected");
  await page.getByRole("link", { name: "Analyze audio", exact: true }).first().click();
  await expect(page.locator("input[type=file]")).toHaveCount(1);
  await expect(page.locator(".result")).toHaveCount(0);
  expect(errors).toEqual([]);
});
