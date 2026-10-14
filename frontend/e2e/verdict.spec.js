import { test, expect } from "@playwright/test";
import { resolve } from "node:path";

for (const [file, prediction, heading, explanation] of [
  ["spoof_1.wav", "spoof", "POTENTIAL SPOOF DETECTED", "Potential synthetic or manipulated speech signals detected. Verify independently."],
  ["bonafide_1.wav", "below_threshold", "NO SPOOF ALERT — INCONCLUSIVE", "No acoustic spoof alert was raised. This does not verify that the recording is genuine or safe."],
]) {
  test(`prominent ${prediction} verdict uses real scores and hides bonafide scores everywhere`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/analyze");
    await page.locator("input[type=file]").setInputFiles(resolve("../test_audio", file));
    const response = page.waitForResponse((r) => r.url().endsWith("/api/analyze") && r.status() === 200);
    await page.getByRole("button", { name: "Analyze recording" }).click();
    const data = await (await response).json();
    expect(data.acoustic.prediction).toBe(prediction);
    expect(Number.isFinite(data.acoustic.bonafide_score)).toBe(true);
    const result = page.locator(".result");
    await expect(result.locator(".verdict-title")).toHaveText(heading);
    await expect(result.locator(".verdict-title")).toBeInViewport();
    await expect(result).toContainText(explanation);
    await expect(result.locator(".score-grid")).toContainText(data.acoustic.spoof_score.toFixed(8));
    await expect(result.locator(".score-grid")).toContainText(String(data.acoustic.threshold));
    await expect(result).not.toContainText("Bonafide model score");
    await expect(result).not.toContainText(data.acoustic.bonafide_score.toFixed(8));
    expect(await result.locator(".detection-verdict").evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
    await expect(result.locator(".facts")).toBeHidden();
    await result.locator("summary").click();
    await expect(result.locator(".facts")).toBeVisible();
    await page.goto("/history");
    await page.getByRole("button", { name: `View ${file}` }).click();
    await expect(page.getByRole("dialog").locator(".verdict-title")).toHaveText(heading);
    await expect(page.getByRole("dialog")).not.toContainText("Bonafide model score");
    await page.keyboard.press("Escape");
    await page.goto("/");
    await expect(page.locator("main")).not.toContainText("Bonafide model score");
    await page.goto("/demo");
    await page.getByRole("button", { name: "Run comparison" }).click();
    const card = page.locator(`.demo-sample.${prediction === "spoof" ? "spoof" : "bonafide"}`);
    await expect(card.locator(".verdict-title")).toHaveText(heading, { timeout: 30000 });
    await expect(page.locator("main")).not.toContainText("Bonafide model score");
  });
}
