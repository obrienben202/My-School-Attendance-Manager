import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const baseUrl = new URL(process.env.E2E_BASE_URL || "http://localhost/");
const username = process.env.E2E_ADMIN_USERNAME;
const password = process.env.E2E_ADMIN_PASSWORD;
const chromiumPath = process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium";
const fixtureKey = "__admin_register_e2e_feed";

if (!username || !password) {
  throw new Error("Set E2E_ADMIN_USERNAME and E2E_ADMIN_PASSWORD in Replit Secrets to run the administrator browser check.");
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

async function expectRows(page, entries) {
  await page.waitForFunction(
    (expected) => {
      const rows = [...document.querySelectorAll("tbody tr[data-schedule-id]")];
      return rows.length === expected.length &&
        rows.every(row => expected.some(entry =>
          row.dataset.scheduleId === String(entry.id) &&
          row.dataset.occurrenceDate === entry.occurrenceDate
        ));
    },
    entries,
  );
  const rows = page.locator("tbody tr[data-schedule-id]");
  assert.equal(await rows.count(), entries.length);
  for (const entry of entries) {
    // The row itself carries the schedule attributes; do not depend on sort order.
    const selected = page.locator(`tbody tr[data-schedule-id="${entry.id}"][data-occurrence-date="${entry.occurrenceDate}"]`);
    assert.equal(await selected.count(), 1);
    assert.ok((await selected.textContent()).includes(entry.staffName));
    assert.ok((await selected.textContent()).includes(entry.courseCode));
    assert.ok((await selected.textContent()).includes(
      entry.registerStatus === "draft" ? "Saved" : entry.registerStatus === "submitted" ? "Submitted" : "Open",
    ));
  }
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
  await page.getByRole("button", { name: "Sign in" }).click();
  try {
    await page.waitForFunction(async () => {
      const response = await fetch("/api/auth/user", { credentials: "include", cache: "no-store" });
      return response.ok && (await response.json()).user?.role === "admin";
    }, null, { timeout: 45_000 });
  } catch {
    const loginError = await page.locator("form p").textContent().catch(() => null);
    throw new Error(`Administrator sign-in did not establish an admin session${loginError ? `: ${loginError}` : "."}`);
  }
  await page.getByRole("link", { name: "eRegisters", exact: true }).waitFor();
  await page.goto(new URL("/attendance", baseUrl).toString(), { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "eRegisters" }).waitFor();
  await page.getByText("Today's eRegisters across staff.", { exact: false }).waitFor();

  const liveResponse = await page.evaluate(async () => {
    const response = await fetch("/api/schedule/today", { credentials: "include", cache: "no-store" });
    return { status: response.status, body: await response.json() };
  });
  assert.equal(liveResponse.status, 200, "the signed-in administrator feed should load");
  assert.ok(Array.isArray(liveResponse.body), "the administrator feed should be a list");
  const today = schoolDate();
  const liveToday = liveResponse.body.filter(entry =>
    entry.occurrenceDate === today && entry.day?.trim().toLowerCase() === weekday(today).toLowerCase()
  );
  if (liveToday.length) await page.locator("tbody tr[data-schedule-id]").first().waitFor();
  else if (liveResponse.body.length) await page.getByText("No registers scheduled today", { exact: true }).waitFor();
  else await page.getByText("No active timetable lessons found", { exact: true }).waitFor();
  assert.deepEqual(
    await page.locator("tbody tr[data-schedule-id]").evaluateAll(rows =>
      rows.map(row => `${row.dataset.scheduleId}:${row.dataset.occurrenceDate}`).sort()),
    liveToday.map(entry => `${entry.id}:${entry.occurrenceDate}`).sort(),
    "the real administrator page should display only today's feed occurrences",
  );

  // Keep authentication real, but make the list data deterministic across school timetables.
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
    id, courseId: id, courseCode: `E2E-${id}`, courseName: "Administrator fixture",
    startTime: "10:00", endTime: "11:00", room: "B12", staffName,
    enrolledCount: 2, registerMarked: registerStatus !== "open", registerStatus,
    registerUpdatedAt: null, registerSubmittedAt: null, occurrenceDate, day,
  });
  const visible = [
    entry(990001, "Mrs Claire Jones", "open", today, weekday(today)),
    entry(990002, "Mr Ahmed Khan", "draft", today, weekday(today)),
    entry(990003, "Ms Robin Lee", "submitted", today, weekday(today)),
  ];
  const otherDay = offsetDate(today, -1);
  const excluded = [
    entry(990004, "Mr Other Day", "submitted", otherDay, weekday(otherDay)),
    entry(990005, "Mrs Next Week", "draft", offsetDate(today, 7), weekday(today)),
    entry(990006, "Ms Wrong Weekday", "open", today, weekday(offsetDate(today, 1))),
  ];
  await page.evaluate(({ key, feed }) => localStorage.setItem(key, JSON.stringify(feed)),
    { key: fixtureKey, feed: [...visible, ...excluded] });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expectRows(page, visible);
  await expectTotals(page, 1, 1, 1);
  await page.getByText("3 registers", { exact: true }).waitFor();

  await page.evaluate(({ key, feed }) => localStorage.setItem(key, JSON.stringify(feed)),
    { key: fixtureKey, feed: excluded });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("No registers scheduled today", { exact: true }).waitFor();
  await page.getByText("There are no active timetable lessons on today's school calendar day.", { exact: true }).waitFor();
  assert.equal(await page.locator("tbody tr[data-schedule-id]").count(), 0);
  await expectTotals(page, 0, 0, 0);
  await page.getByText("0 registers", { exact: true }).waitFor();

  await page.evaluate(key => localStorage.setItem(key, "[]"), fixtureKey);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("No active timetable lessons found", { exact: true }).waitFor();
  await expectTotals(page, 0, 0, 0);
  console.info("Administrator eRegisters browser check passed: signed-in feed, cross-staff daily list, totals, and both empty states.");
  await context.close();
} finally {
  await browser.close();
}