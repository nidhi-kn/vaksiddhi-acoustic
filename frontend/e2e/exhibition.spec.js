import { test, expect } from "@playwright/test";

test("exhibition layouts remain usable at every target width", async ({ page }) => {
  test.setTimeout(90000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [320, 390, 768, 1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/analyze", "/record", "/history", "/demo", "/model", "/about"]) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} at ${width}px`).toBe(true);
    }
  }
  await page.goto("/");
  await expect(page.locator(".activity-heading")).toContainText("Locally saved activity");
  await expect(page.locator(".metric").first()).toContainText("0");
  await expect(page.getByText("No activity yet")).toBeVisible();
  const cta = page.locator(".acoustic-hero").getByRole("link", { name: "Analyze audio" });
  await cta.focus();
  expect(await cta.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("solid");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/analyze$/);
  expect(errors).toEqual([]);
});

test("decorative waveform respects reduced motion and reports no model result", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  expect(await page.locator(".waveform-band").evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  await expect(page.locator(".acoustic-art")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator(".result")).toHaveCount(0);
});
