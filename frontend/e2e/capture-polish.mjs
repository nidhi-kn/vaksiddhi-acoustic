// Capture real local inference, never seeded/mock analysis results.
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

const [stage, baseURL] = process.argv.slice(2);
if (!["before", "after"].includes(stage) || !baseURL) throw new Error("Usage: node e2e/capture-polish.mjs before|after http://127.0.0.1:PORT");
const output = resolve("../docs/ui-exhibition/screenshots", stage);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
try {
  for (const width of [1366, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 768 }, reducedMotion: "reduce", baseURL });
    const page = await context.newPage();
    await page.goto("/demo");
    await page.getByRole("button", { name: "Run comparison" }).click();
    await page.locator(".demo-sample.spoof .result").waitFor({ timeout: 30000 });
    await page.screenshot({ path: resolve(output, `demo-${width}.png`), fullPage: true });
    await page.goto("/");
    await page.locator(".metric").first().waitFor();
    await page.waitForTimeout(500);
    await page.screenshot({ path: resolve(output, `dashboard-${width}.png`), fullPage: true });
    await page.goto("/analyze");
    await page.locator("input[type=file]").setInputFiles(resolve("../test_audio/spoof_1.wav"));
    await page.getByRole("button", { name: "Analyze recording" }).click();
    await page.locator(".result").waitFor({ timeout: 30000 });
    await page.screenshot({ path: resolve(output, `analysis-${width}.png`), fullPage: true });
    await context.close();
  }
} finally {
  await browser.close();
}
