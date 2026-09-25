import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const baseUrl = new URL(process.env.E2E_BASE_URL || "http://localhost/");
const username = process.env.E2E_HOD_USERNAME;
const password = process.env.E2E_HOD_PASSWORD;
const chromiumPath = process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium";
const fixtureKey = "__hod_register_e2e_feed";

if (!username || !password) {
  throw new Error("Set E2E_HOD_USERNAME and E2E_HOD_PASSWORD in Replit Secrets to run the HOD browser check.");
}

function schoolDate() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const value = (type) => parts.find(part => part.type === type).value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function weekday(date) {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
    new Date(`${date}T00:00:00Z`).getUTCDay()
  ];
}

function offsetDate(date, days) {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function keys(entries) {
  return entries.map(entry => `${entry.id}:${entry.occurrenceDate}`).sort();
}

async function visibleKeys(page) {
  return page.locator("tbody tr[data-schedule-id]").evaluateAll(rows =>
    rows.map(row => `${row.dataset.scheduleId}:${row.dataset.occurrenceDate}`).sort(),
  );
}

async function expectTotals(page, open, saved, submitted) {
  for (const [label, count] of [
    ["Open (Due)", open],
    ["Saved (Draft)", saved],
    ["Submitted (Final)", submitted],
  ]) {
    const card = page.getByText(label, { exact: true }).locator("..");
    assert.equal((await card.locator("div.text-2xl").textContent())?.trim(), String(count), label);
  }
}

const browser = await chromium.launch({
  headless: true,
  executablePath: chromiumPath,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  await page.goto(new URL("/", baseUrl).toString(), { waitUntil: "domcontentloaded" });
  await page.locator('input[autocomplete="username"]').fill(username);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  const loginResponse = page.waitForResponse(response =>
    new URL(response.url()).pathname === "/api/login" && response.request().method() === "POST",
    { timeout: 45_000 },
  );
  await page.getByRole("button", { name: "Sign in" }).click();
  const login = await loginResponse;
  if (!login.ok()) {
    const body = await login.json().catch(() => ({}));
    throw new Error(`HOD sign-in failed (HTTP ${login.status()}): ${body.error ?? "Unknown error"}`);
  }
  try {
    await page.waitForFunction(async () => {
      const response = await fetch("/api/auth/user", { credentials: "include", cache: "no-store" });
      return response.ok && (await response.json()).user?.role === "hod";
    }, null, { timeout: 45_000 });
  } catch {
    const loginError = await page.locator("form p").textContent().catch(() => null);
    throw new Error(`HOD sign-in did not establish a hod session${loginError ? `: ${loginError}` : "."}`);
  }
  // Let the login mutation finish before navigating away from the signed-in page.
  await page.getByRole("link", { name: "eRegisters", exact: true }).waitFor();
  await page.goto(new URL("/attendance", baseUrl).toString(), { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "eRegisters" }).waitFor();
  await page.getByText("Today's eRegisters across staff.", { exact: false }).waitFor();

  const liveResponse = await page.evaluate(async () => {
    const response = await fetch("/api/schedule/today", { credentials: "include", cache: "no-store" });
    return { status: response.status, body: await response.json() };
  });
  assert.equal(liveResponse.status, 200, "the signed-in HOD feed should load");
  assert.ok(Array.isArray(liveResponse.body), "the HOD feed should be a list");
  const today = schoolDate();
  const liveToday = liveResponse.body.filter(entry =>
    entry.occurrenceDate === today && entry.day?.trim().toLowerCase() === weekday(today).toLowerCase()
  );
  if (liveToday.length) await page.locator("tbody tr[data-schedule-id]").first().waitFor();
  else if (liveResponse.body.length) await page.getByText("No registers scheduled today", { exact: true }).waitFor();
  else await page.getByText("No active timetable lessons found", { exact: true }).waitFor();
  assert.deepEqual(await visibleKeys(page), keys(liveToday),
    "the real HOD page should display only today's feed occurrences");

  // Keep the HOD session and live-feed check real; control only the list data after that.
  await context.addInitScript(key => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const inputUrl = typeof input === "string" || input instanceof URL ? String(input) : input.url;
      if (new URL(inputUrl, window.location.href).pathname === "/api/schedule/today") {
        const fixture = localStorage.getItem(key);
        if (fixture !== null) return Promise.resolve(new Response(fixture, {
          status: 200,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        }));
      }
      return nativeFetch(input, init);
    };
  }, fixtureKey);

  const entry = (id, staffName, registerStatus, occurrenceDate, day) => ({
    id, courseId: id, courseCode: `HOD-E2E-${id}`, courseName: "HOD fixture",
    startTime: "10:00", endTime: "11:00", room: "B12", staffName,
    enrolledCount: 2, registerMarked: registerStatus !== "open", registerStatus,
    registerUpdatedAt: null, registerSubmittedAt: null, occurrenceDate, day,
  });
  const visible = [
    entry(991001, "Mrs Claire Jones", "open", today, weekday(today)),
    entry(991002, "Mr Ahmed Khan", "draft", today, weekday(today)),
    entry(991003, "Ms Robin Lee", "submitted", today, weekday(today)),
  ];
  const otherDay = offsetDate(today, -1);
  const excluded = [
    entry(991004, "Mr Other Day", "submitted", otherDay, weekday(otherDay)),
    entry(991005, "Mrs Next Week", "draft", offsetDate(today, 7), weekday(today)),
    entry(991006, "Ms Wrong Weekday", "open", today, weekday(offsetDate(today, 1))),
  ];
  await page.evaluate(({ key, feed }) => localStorage.setItem(key, JSON.stringify(feed)),
    { key: fixtureKey, feed: [...visible, ...excluded] });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(expected =>
    document.querySelectorAll("tbody tr[data-schedule-id]").length === expected, visible.length);
  assert.deepEqual(await visibleKeys(page), keys(visible),
    "HOD should see today's lessons across different staff, not other dates or weekdays");
  for (const item of visible) {
    const row = page.locator(`tbody tr[data-schedule-id="${item.id}"][data-occurrence-date="${item.occurrenceDate}"]`);
    assert.equal(await row.count(), 1);
    const text = await row.textContent();
    assert.ok(text.includes(item.staffName), `HOD row ${item.id} should name its assigned staff member`);
    assert.ok(text.includes(item.courseCode), `HOD row ${item.id} should name its course`);
    assert.ok(text.includes(item.registerStatus === "draft" ? "Saved" : item.registerStatus === "submitted" ? "Submitted" : "Open"));
  }
  await expectTotals(page, 1, 1, 1);
  await page.getByText("3 registers", { exact: true }).waitFor();

  await page.evaluate(({ key, feed }) => localStorage.setItem(key, JSON.stringify(feed)),
    { key: fixtureKey, feed: excluded });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("No registers scheduled today", { exact: true }).waitFor();
  await page.getByText("There are no active timetable lessons on today's school calendar day.", { exact: true }).waitFor();
  assert.deepEqual(await visibleKeys(page), []);
  await expectTotals(page, 0, 0, 0);
  await page.getByText("0 registers", { exact: true }).waitFor();

  console.info("HOD eRegisters browser check passed: signed-in HOD feed, cross-staff daily list, totals, and no-lessons-today guidance.");
  await context.close();
} finally {
  await browser.close();
}