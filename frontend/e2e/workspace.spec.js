import { test, expect } from "@playwright/test";

function wav() {
  const data = Buffer.alloc(32044);
  data.write("RIFF");
  data.writeUInt32LE(32036, 4);
  data.write("WAVE", 8);
  data.write("fmt ", 12);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(16000, 24);
  data.writeUInt32LE(32000, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(32000, 40);
  return data;
}

test("real upload, result, history persistence, filters and clear", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("No activity yet")).toBeVisible();
  await page.goto("/analyze");
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "invalid.mp3",
      mimeType: "audio/mpeg",
      buffer: Buffer.from("bad"),
    });
  await expect(page.getByRole("alert")).toContainText("WAV");
  await page
    .locator("input[type=file]")
    .setInputFiles({ name: "smoke.wav", mimeType: "audio/wav", buffer: wav() });
  await expect(
    page.getByRole("button", { name: "Analyze recording" }),
  ).toBeEnabled();
  const pixels = await page
    .locator("canvas")
    .evaluate((canvas) =>
      [
        ...canvas
          .getContext("2d")
          .getImageData(0, 0, canvas.width, canvas.height).data,
      ].some((value) => value > 0),
    );
  expect(pixels).toBe(true);
  await page.getByRole("button", { name: "Analyze recording" }).click();
  await expect(page.getByText("Analysis result", { exact: true })).toBeVisible({
    timeout: 120000,
  });
  await expect(page.getByText("Spoof model score")).toBeVisible();
  await page.goto("/history");
  await expect(page.getByText("smoke.wav", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("smoke.wav", { exact: true })).toBeVisible();
  await page.getByLabel("Search recordings").fill("no-match");
  await expect(page.getByText("No matching recordings")).toBeVisible();
  await page.getByLabel("Search recordings").clear();
  await page.getByRole("button", { name: "View smoke.wav" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/");
  await expect(page.locator(".metric").first()).toContainText("1");
  await expect(page.locator(".recharts-area-curve").first()).toBeVisible();
  await page.waitForTimeout(1800);
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  await page.goto("/history");
  await page
    .getByRole("button", { name: "Clear history", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Clear history" })
    .click();
  await expect(page.getByText("No analyses saved yet")).toBeVisible();
});

test("microphone captures then converts to WAV and analyzes", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["microphone"]);
  await page.goto("/record");
  await page.getByRole("button", { name: "Start recording" }).click();
  await expect(page.getByText("Recording in progress")).toBeVisible();
  await expect(page.locator(".timer")).not.toHaveText("0:00");
  await page.getByRole("button", { name: "Stop recording" }).click();
  await expect(
    page.getByRole("button", { name: "Analyze recording" }),
  ).toBeEnabled({ timeout: 15000 });
  await page.getByRole("button", { name: "Analyze recording" }).click();
  await expect(page.getByText("Analysis result", { exact: true })).toBeVisible({
    timeout: 120000,
  });
});

test("six pages on desktop and mobile fit the viewport", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/",
      "/analyze",
      "/record",
      "/history",
      "/model",
      "/about",
    ]) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    if (width === 390) {
      await page.getByLabel("Toggle navigation").click();
      await page
        .getByRole("link", { name: "Analyze audio", exact: true })
        .click();
      await expect(page.locator("h1")).toHaveText("Analyze audio");
      await page.screenshot({
        path: "test-results/analyze-mobile.png",
        fullPage: true,
      });
    }
  }
  expect(errors).toEqual([]);
});

test("drag and drop upload and unavailable API error", async ({ page }) => {
  await page.goto("/analyze");
  const data = await page.evaluateHandle(
    (bytes) => {
      const transfer = new DataTransfer();
      transfer.items.add(
        new File([new Uint8Array(bytes)], "drop.wav", { type: "audio/wav" }),
      );
      return transfer;
    },
    [...wav()],
  );
  await page.locator(".dropzone").dispatchEvent("drop", { dataTransfer: data });
  await expect(
    page.getByRole("button", { name: "Analyze recording" }),
  ).toBeEnabled();
  await page.route("**/api/analyze", (route) => route.abort());
  await page.getByRole("button", { name: "Analyze recording" }).click();
  await expect(page.getByRole("alert")).toContainText("Analysis failed");
  await expect(
    page.getByRole("button", { name: "Analyze recording" }),
  ).toBeEnabled();
});
