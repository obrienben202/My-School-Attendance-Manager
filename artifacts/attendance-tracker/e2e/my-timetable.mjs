import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { timetableFixture } from "./my-timetable-fixtures.mjs";
import { assertContained, assertPrintOutput, assertWeeklyContents, timetableColors } from "./my-timetable-assertions.mjs";

const baseUrl = new URL(process.env.E2E_BASE_URL || "http://localhost/");
if (!baseUrl.pathname.endsWith("/")) baseUrl.pathname += "/";
const url = path => new URL(path, baseUrl).toString();
const username = process.env.E2E_STAFF_USERNAME;
const password = process.env.E2E_STAFF_PASSWORD;
if (!username || !password) {
  throw new Error("Set E2E_STAFF_USERNAME and E2E_STAFF_PASSWORD in Replit Secrets before running this browser check.");
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  await context.addInitScript(() => {
    localStorage.setItem("attendance-theme", "light");
    // Exercise the real popup/document builder but don't launch an OS printer.
    const open = window.open.bind(window);
    window.open = (...args) => {
      const popup = open(...args);
      if (popup) popup.print = () => { popup.__timetablePrintCalled = true; };
      return popup;
    };
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto(url(""), { waitUntil: "domcontentloaded" });
  await page.locator('input[autocomplete="username"]').fill(username);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForFunction(async authUrl => {
    const response = await fetch(authUrl, { credentials: "include", cache: "no-store" });
    return response.ok && (await response.json()).user?.role === "staff";
  }, url("api/auth/user"), { timeout: 45_000 });
  // A valid cookie can precede the login mutation's redirect: wait for the signed-in shell.
  await page.getByRole("link", { name: "eRegisters", exact: true }).waitFor();

  let mode = "loading";
  let releaseLoading;
  const loadingGate = new Promise(resolve => { releaseLoading = resolve; });
  let timetableReads = 0;
  const unexpectedWrites = [];
  await context.route(/\/api\//, async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    // After real sign-in this check is strictly read-only, including unexpected UI writes.
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      unexpectedWrites.push(`${request.method()} ${pathname}`);
      return route.abort("blockedbyclient");
    }
    if (pathname !== new URL(url("api/staff/my-timetable")).pathname) return route.continue();
    timetableReads++;
    const responseMode = mode;
    if (responseMode === "loading") await loadingGate;
    return route.fulfill({
      status: responseMode === "error" ? 503 : 200,
      contentType: "application/json",
      headers: { "Cache-Control": "no-store" },
      body: JSON.stringify(responseMode === "error" ? { error: "Synthetic timetable outage" }
        : responseMode === "empty" ? [] : timetableFixture),
    });
  });

  await page.goto(url("my-details"), { waitUntil: "domcontentloaded" });
  const open = page.getByTestId("button-my-timetable");
  const dialog = page.getByRole("dialog", { name: "My timetable", exact: true });
  await open.waitFor();
  assert.equal(timetableReads, 0, "timetable should not load before opening the dialog");
  await open.click();
  await dialog.getByLabel("Loading timetable").waitFor();
  assert.equal(await dialog.getByTestId("button-print-timetable").count(), 0, "loading must not offer printing");
  releaseLoading();
  mode = "success";
  await assertWeeklyContents(dialog);
  await assertContained(page, dialog, false);
  const light = await timetableColors(dialog);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });

  // Use the app's real theme toggle, not a hand-added .dark class.
  await page.getByRole("button", { name: "Use dark mode", exact: true }).click();
  await page.waitForFunction(() => document.documentElement.classList.contains("dark"));
  await open.click();
  await assertWeeklyContents(dialog);
  const dark = await timetableColors(dialog);
  assert.notEqual(dark.dialog, light.dialog, "dialog must change background in dark mode");
  for (const part of ["header", "entry", "additional"]) {
    assert.notEqual(dark[part].background, light[part].background, `${part} must respond to dark mode`);
  }
  assert.notEqual(dark.title.color, light.title.color, "session titles must respond to dark mode");
  assert.ok(dark.textContrast.every(ratio => ratio >= 4.5), "dark session titles, times and details must remain readable");

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await assertContained(page, dialog, true);
    await assertWeeklyContents(dialog);
  }
  // Verify the actual Print button still opens the complete document from a narrow dark-mode dialog.
  const popupReady = page.waitForEvent("popup");
  await dialog.getByTestId("button-print-timetable").click();
  const popup = await popupReady;
  await assertPrintOutput(popup);
  await popup.close();
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open.click();
  await assertWeeklyContents(dialog);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });

  // Reload to clear the query cache so error/empty states cannot pass on previous data.
  mode = "error";
  await page.reload({ waitUntil: "domcontentloaded" });
  await open.click();
  await dialog.getByText("Timetable could not be loaded.", { exact: true }).waitFor({ timeout: 45_000 });
  assert.equal(await dialog.getByTestId("button-print-timetable").count(), 0);
  assert.equal(await dialog.getByTestId("table-weekly-timetable").count(), 0);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await open.click();
  await dialog.getByText("Timetable could not be loaded.", { exact: true }).waitFor({ timeout: 45_000 });
  const readsBeforeRetry = timetableReads;
  mode = "success";
  await dialog.getByTestId("button-retry-timetable").click();
  await assertWeeklyContents(dialog);
  assert.ok(timetableReads > readsBeforeRetry, "Try again must request a new response");
  assert.equal(await dialog.getByTestId("button-retry-timetable").count(), 0);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });

  mode = "empty";
  await page.reload({ waitUntil: "domcontentloaded" });
  await open.click();
  await dialog.getByTestId("status-no-timetable").waitFor();
  assert.equal(await dialog.getByTestId("button-print-timetable").count(), 0);
  assert.equal(await dialog.getByTestId("table-weekly-timetable").count(), 0);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.deepEqual(unexpectedWrites, [], "no fixture or assignment writes may reach the server");
  assert.deepEqual(pageErrors, [], "the timetable flow must not raise browser exceptions");
  console.log("Personal timetable passed: signed-in loading, weekly placement, overlapping records, dark mode, 390/320px containment, popup/PDF landscape printing, close/reopen, retry and empty state. Browser-only fixtures; no assignment writes.");
} finally {
  await browser.close();
}
