import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve("..");
const cases = [
  ["spoof_1.wav", "spoof", "Potential Spoof Detected"],
  ["bonafide_1.wav", "below_threshold", "No Spoof Alert / Inconclusive"],
];

test("exact WAV files preserve CLI decisions through live API, rendering and history", async ({
  page,
}) => {
  test.setTimeout(120000);
  for (const [filename, prediction] of cases) {
    const file = resolve(root, "test_audio", filename);
    const cli = JSON.parse(
      execFileSync(
        resolve(root, ".venv/Scripts/python.exe"),
        ["-m", "demo.run_audio", file],
        { cwd: root, encoding: "utf8" },
      ),
    );
    await page.goto("/analyze");
    await page.locator("input[type=file]").setInputFiles(file);
    await expect(
      page.getByRole("button", { name: "Analyze recording" }),
    ).toBeEnabled();
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/analyze") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Analyze recording" }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    const api = await response.json();
    expect(api.acoustic.prediction).toBe(prediction);
    expect(api.acoustic.threshold).toBe(cli.acoustic.threshold);
    expect(api.risk_level).toBe(cli.risk_level);
    for (const key of ["spoof_score", "bonafide_score"])
      expect(api.acoustic[key]).toBeCloseTo(cli.acoustic[key], 6);
    await expect(page.locator(".result")).toBeVisible();
    console.log(
      JSON.stringify({
        filename,
        acoustic: api.acoustic,
        rendered: await page.locator(".result").innerText(),
      }),
    );
    await page.screenshot({
      path: `test-results/${filename}-result.png`,
      fullPage: true,
    });
    await expect(page.locator(".result .verdict-title")).toHaveText(prediction === "spoof" ? "POTENTIAL SPOOF DETECTED" : "NO SPOOF ALERT — INCONCLUSIVE");
    await expect(page.locator(".result")).not.toContainText("Bonafide model score");
    await expect(page.locator(".result .verdict-comparison")).toContainText(prediction === "spoof" ? "meets or exceeds" : "below");
    await expect(page.locator(".result .result-technical")).not.toHaveAttribute("open", "");
    await expect(page.locator(".result")).toContainText(
      String(api.acoustic.threshold),
    );
    await expect(page.locator(".score-grid")).toContainText(
      api.acoustic.spoof_score.toFixed(8),
    );
  }
  await page.goto("/history");
  await page.reload();
  for (const [filename, prediction, label] of cases) {
    const row = page.getByRole("row").filter({ hasText: filename });
    await expect(row.locator(".badge")).toHaveText(label);
    await row.getByRole("button", { name: `View ${filename}` }).click();
    await expect(page.getByRole("dialog").locator(".result .verdict-title")).toHaveText(
      prediction === "spoof" ? "POTENTIAL SPOOF DETECTED" : "NO SPOOF ALERT — INCONCLUSIVE",
    );
    await page.keyboard.press("Escape");
    const records = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("vak-history-v1")),
    );
    expect(
      records.find((record) => record.audio_file === filename).acoustic
        .prediction,
    ).toBe(prediction);
  }
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole("button", { name: "View spoof_1.wav" }).click();
    await expect(
      page.getByRole("dialog").getByText("POTENTIAL SPOOF DETECTED", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/parity-${width}.png`,
      fullPage: true,
    });
    await page.keyboard.press("Escape");
  }
});
