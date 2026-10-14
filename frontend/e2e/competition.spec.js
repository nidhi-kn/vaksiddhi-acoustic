import { test, expect } from "@playwright/test";

test("offline local demo computes real results, persists both records and renders on projectors and mobile", async ({
  page,
}) => {
  test.setTimeout(120000);
  const external = [];
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
      external.push(url.href);
      return route.abort();
    }
    return route.continue();
  });
  await page.goto("/demo");
  await expect(page.locator(".awaiting-result")).toHaveCount(2);
  await expect(page.locator(".truth-label").first()).toHaveText(
    "Dataset label: bonafide",
  );
  const received = [];
  page.on("response", async (response) => {
    if (response.url().endsWith("/api/analyze") && response.status() === 200)
      received.push(await response.json());
  });
  await page.getByRole("button", { name: "Run comparison" }).click();
  await expect(page.locator(".demo-sample.bonafide .result .badge")).toHaveText(
    "No Spoof Alert / Inconclusive",
    { timeout: 30000 },
  );
  await expect(page.locator(".demo-sample.spoof .result .badge")).toHaveText(
    "Potential Spoof Detected",
  );
  await expect(
    page.getByRole("button", { name: "Run comparison" }),
  ).toBeEnabled();
  expect(received).toHaveLength(2);
  expect(
    received.find((item) => item.audio_file === "spoof_1.wav").acoustic
      .spoof_score,
  ).toBeCloseTo(0.1198771521449089, 6);
  expect(
    received.find((item) => item.audio_file === "bonafide_1.wav").acoustic
      .spoof_score,
  ).toBeCloseTo(0.0033067096956074238, 6);
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
    { width: 320, height: 740 },
  ]) {
    await page.setViewportSize(viewport);
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await expect
      .poll(() =>
        page
          .locator(".recharts-wrapper")
          .evaluate(
            (element) => element.getBoundingClientRect().right <= innerWidth,
          ),
      )
      .toBe(true);
    await page.waitForTimeout(1800);
    await expect(
      page.locator(".demo-sample.spoof .result .badge"),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/competition-${viewport.width}.png`,
      fullPage: true,
    });
  }
  const playback = page.locator(".demo-sample.bonafide audio");
  await playback.evaluate(async (audio) => {
    audio.muted = true;
    await audio.play();
  });
  await expect
    .poll(() => playback.evaluate((audio) => audio.currentTime))
    .toBeGreaterThan(0);
  await playback.evaluate((audio) => audio.pause());
  await page.goto("/history");
  await page.reload();
  await expect(
    page.getByRole("row").filter({ hasText: "bonafide_1.wav" }),
  ).toContainText("No Spoof Alert / Inconclusive");
  await expect(
    page.getByRole("row").filter({ hasText: "spoof_1.wav" }),
  ).toContainText("Potential Spoof Detected");
  await page.goto("/demo");
  await expect(page.locator(".awaiting-result")).toHaveCount(2);
  await page
    .getByLabel("spoof sample", { exact: true })
    .selectOption("spoof_2.wav");
  await page.getByRole("button", { name: "Run comparison" }).click();
  await expect(page.locator(".demo-sample.spoof .result")).toBeVisible({
    timeout: 30000,
  });
  await expect(
    page.getByRole("button", { name: "Run comparison" }),
  ).toBeEnabled();
  expect(external).toEqual([]);
});

test("demo network failures never become sample predictions", async ({
  page,
}) => {
  await page.goto("/demo");
  await page.route("**/api/analyze", (route) => route.abort());
  await page.getByRole("button", { name: "Run comparison" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator(".result")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Run comparison" }),
  ).toBeEnabled();
});

test("microphone permission rejection is recoverable and reduced motion is respected", async ({
  playwright,
}) => {
  const browser = await playwright.chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    args: ["--use-fake-device-for-media-stream"],
  });
  const context = await browser.newContext({
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5173",
  });
  const page = await context.newPage();
  try {
    await context.grantPermissions([]);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/record");
    await page.getByRole("button", { name: "Start recording" }).click();
    await expect(page.getByRole("alert")).toContainText(
      "permission was denied",
    );
    await expect(
      page.getByRole("button", { name: "Start recording" }),
    ).toBeEnabled();
    await page.goto("/demo");
    expect(
      await page
        .locator("button.button")
        .evaluate((button) => getComputedStyle(button).transitionDuration),
    ).toBe("0s");
  } finally {
    await browser.close();
  }
});
