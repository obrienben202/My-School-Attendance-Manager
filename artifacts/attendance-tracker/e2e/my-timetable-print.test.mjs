import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright-core";
import { timetablePrintDocument } from "../src/pages/my-timetable-print.ts";
import { timetableFixture } from "./my-timetable-fixtures.mjs";
import { assertPrintOutput } from "./my-timetable-assertions.mjs";

// Runs the same print assertions without an API or credentials. This supplements,
// but does not replace, the signed-in check of the dialog's real Print button.
test("rendered timetable and PDF retain every weekday and additional record", async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    await page.setContent(timetablePrintDocument("Synthetic staff", timetableFixture));
    await page.evaluate(() => { window.__timetablePrintCalled = true; });
    await assertPrintOutput(page);

    // Prove the check fails on representative regressions, not just on exceptions.
    await page.getByRole("columnheader", { name: "Friday", exact: true }).evaluate(el => el.remove());
    await assert.rejects(() => assertPrintOutput(page), /Friday/);
    await page.setContent(timetablePrintDocument("Synthetic staff", timetableFixture));
    await page.locator("section .additional").last().evaluate(el => el.remove());
    await assert.rejects(() => assertPrintOutput(page), /strictly equal/);
  } finally {
    await browser.close();
  }
});
