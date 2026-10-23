import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const baseUrl = new URL(process.env.E2E_BASE_URL || "http://localhost/");
const username = process.env.E2E_STAFF_USERNAME;
const password = process.env.E2E_STAFF_PASSWORD;
const chromiumPath = process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium";
const fixtureModeKey = "__register_e2e_mode";
const fixtureFeedKey = "__register_e2e_feed";

if (!username || !password) {
  throw new Error(
    "Set E2E_STAFF_USERNAME and E2E_STAFF_PASSWORD in Replit Secrets before running this browser check.",
  );
}

function scheduleKeys(entries) {
  return entries
    .map((entry) => `${entry.id}:${entry.occurrenceDate}`)
    .sort();
}

function schoolDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const value = (type) => parts.find(part => part.type === type).value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function schoolWeekday(date) {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
    new Date(`${date}T00:00:00Z`).getUTCDay()
  ];
}

function dueToday(entries, today) {
  return entries.filter(entry =>
    entry.occurrenceDate === today && entry.day?.trim().toLowerCase() === schoolWeekday(today).toLowerCase()
  );
}

async function visibleScheduleKeys(page) {
  return page.locator("tbody tr[data-schedule-id]").evaluateAll((rows) =>
    rows
      .map((row) => `${row.dataset.scheduleId}:${row.dataset.occurrenceDate}`)
      .sort(),
  );
}

async function setScheduleFixture(page, mode, feed = []) {
  await page.evaluate(
    ({ modeKey, feedKey, fixtureMode, fixtureFeed }) => {
      localStorage.setItem(modeKey, fixtureMode);
      localStorage.setItem(feedKey, JSON.stringify(fixtureFeed));
    },
    {
      modeKey: fixtureModeKey,
      feedKey: fixtureFeedKey,
      fixtureMode: mode,
      fixtureFeed: feed,
    },
  );
}

async function expectDetailRoute(page, entry) {
  await page.waitForURL((url) =>
    url.pathname === `/registers/${entry.id}` &&
    url.searchParams.get("date") === entry.occurrenceDate,
  );

  const expectedDisplayDate = await page.evaluate(
    (date) => new Date(`${date}T00:00:00`).toLocaleDateString("en-GB"),
    entry.occurrenceDate,
  );
  await page.getByText("Session Details", { exact: true }).waitFor();
  const dateLine = await page
    .getByText("Session Date", { exact: true })
    .evaluate((element) => element.parentElement?.textContent ?? "");
  assert.ok(
    dateLine.includes(expectedDisplayDate),
    "the register detail page should display the selected occurrence date",
  );
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
    await page.waitForFunction(
      async () => {
        const response = await fetch("/api/auth/user", {
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) return false;
        const result = await response.json();
        return result.user?.role === "staff";
      },
      null,
      { timeout: 45_000 },
    );
  } catch {
    const loginError = await page.locator("form p").textContent().catch(() => null);
    throw new Error(
      `Staff sign-in did not establish an authenticated staff session${loginError ? `: ${loginError}` : "."}`,
    );
  }
  // Wait for the login mutation and redirect before navigating again.
  await page.getByRole("link", { name: "eRegisters", exact: true }).waitFor();

  await page.goto(new URL("/attendance", baseUrl).toString(), {
    waitUntil: "domcontentloaded",
  });
  await page.getByRole("heading", { name: "eRegisters" }).waitFor();
  await page.getByRole("link", { name: "eRegisters", exact: true }).waitFor();

  const liveFeedResponse = await page.evaluate(async () => {
    const response = await fetch("/api/schedule/today", {
      credentials: "include",
      cache: "no-store",
    });
    return { status: response.status, body: await response.json() };
  });
  assert.equal(liveFeedResponse.status, 200, "the signed-in staff feed should load");
  assert.ok(Array.isArray(liveFeedResponse.body), "the staff feed should be a list");
  const liveFeed = liveFeedResponse.body;

  const today = schoolDate();
  const liveToday = dueToday(liveFeed, today);
  if (liveToday.length) await page.locator("tbody tr[data-schedule-id]").first().waitFor();
  else if (liveFeed.length) await page.getByText("No registers scheduled today", { exact: true }).waitFor();
  else await page.getByText("No timetable lessons are assigned to you", { exact: true }).waitFor();
  assert.deepEqual(
    await visibleScheduleKeys(page),
    scheduleKeys(liveToday),
    "the signed-in page should show only today's assigned timetable lessons",
  );

  await context.addInitScript(
    ({ modeKey, feedKey }) => {
      const nativeFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const inputUrl =
          typeof input === "string" || input instanceof URL ? String(input) : input.url;
        const pathname = new URL(inputUrl, window.location.href).pathname;
        const mode = localStorage.getItem(modeKey);

        if (pathname === "/api/schedule/today" && mode === "error") {
          return new Response(JSON.stringify({ error: "Register feed failed" }), {
            status: 503,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          });
        }

        if (pathname === "/api/schedule/today" && mode === "feed") {
          return new Response(localStorage.getItem(feedKey) ?? "[]", {
            status: 200,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          });
        }

        return nativeFetch(input, init);
      };
    },
    { modeKey: fixtureModeKey, feedKey: fixtureFeedKey },
  );

  const initialKeys = scheduleKeys(liveToday);
  const reloadScheduleResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/schedule/today",
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  const reloadResponse = await reloadScheduleResponse;
  assert.equal(reloadResponse.status(), 200, "the session should survive a page reload");
  const reloadedFeed = await reloadResponse.json();
  assert.deepEqual(scheduleKeys(reloadedFeed), initialKeys);
  if (initialKeys.length) await page.locator("tbody tr[data-schedule-id]").first().waitFor();
  else if (liveFeed.length) await page.getByText("No registers scheduled today", { exact: true }).waitFor();
  else await page.getByText("No timetable lessons are assigned to you", { exact: true }).waitFor();
  assert.deepEqual(await visibleScheduleKeys(page), initialKeys);

  const selectedEntry = {
    ...(liveFeed[0] ?? {
      id: 999991, courseId: 1, courseCode: "TEST", courseName: "Fixture lesson",
      startTime: "10:00", endTime: "11:00", room: "B12", staffName: "Fixture staff",
      enrolledCount: 1, registerMarked: false, registerStatus: "open",
      registerUpdatedAt: null, registerSubmittedAt: null,
    }),
    day: schoolWeekday(today), occurrenceDate: today,
  };
  const emptyRosterEntry = { ...selectedEntry, enrolledCount: 0 };
  await setScheduleFixture(page, "feed", [emptyRosterEntry]);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("No enrolled learners found", { exact: true }).waitFor();
  assert.equal(await page.locator("tbody tr[data-schedule-id]").count(), 1);

  await setScheduleFixture(page, "feed", []);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("No timetable lessons are assigned to you", { exact: true }).waitFor();
  assert.equal(await page.locator("tbody tr[data-schedule-id]").count(), 0);

  await setScheduleFixture(page, "error");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("Registers could not be loaded", { exact: true }).waitFor({
    timeout: 45_000,
  });
  await setScheduleFixture(page, "feed", [selectedEntry]);
  await page.getByRole("button", { name: "Try again" }).click();
  await page.locator("tbody tr[data-schedule-id]").first().waitFor();
  assert.deepEqual(await visibleScheduleKeys(page), scheduleKeys([selectedEntry]));

  await setScheduleFixture(page, "feed", [selectedEntry]);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("tbody tr[data-schedule-id]").first().waitFor();
  await page
    .getByPlaceholder("Filter by description, room, or staff…")
    .fill("no-register-can-match-this-text");
  await page.getByText("No registers match these filters", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.locator("tbody tr[data-schedule-id]").first().waitFor();

  const openEntry = { ...selectedEntry, registerStatus: "open" };
  await setScheduleFixture(page, "feed", [openEntry]);
  await page.reload({ waitUntil: "domcontentloaded" });
  const openRow = page.locator(
    `tr[data-schedule-id="${openEntry.id}"][data-occurrence-date="${openEntry.occurrenceDate}"]`,
  );
  await openRow.getByRole("button", { name: "Mark Register" }).click();
  if (liveFeed.length) await expectDetailRoute(page, openEntry);
  else await page.waitForURL((url) =>
    url.pathname === `/registers/${openEntry.id}` && url.searchParams.get("date") === today,
  );

  const submittedEntry = { ...selectedEntry, registerStatus: "submitted" };
  await setScheduleFixture(page, "feed", [submittedEntry]);
  await page.goto(new URL("/attendance", baseUrl).toString(), {
    waitUntil: "domcontentloaded",
  });
  const submittedRow = page.locator(
    `tr[data-schedule-id="${submittedEntry.id}"][data-occurrence-date="${submittedEntry.occurrenceDate}"]`,
  );
  await submittedRow.getByRole("button", { name: "Edit Attendance" }).click();
  if (liveFeed.length) await expectDetailRoute(page, submittedEntry);
  else await page.waitForURL((url) =>
    url.pathname === `/registers/${submittedEntry.id}` && url.searchParams.get("date") === today,
  );

  const previous = new Date(`${today}T12:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  const yesterday = previous.toISOString().slice(0, 10);
  await setScheduleFixture(page, "feed", [{
    ...selectedEntry, day: schoolWeekday(yesterday), occurrenceDate: yesterday,
  }]);
  await page.goto(new URL("/attendance", baseUrl).toString(), { waitUntil: "domcontentloaded" });
  await page.getByText("No registers scheduled today", { exact: true }).waitFor();
  assert.deepEqual(await visibleScheduleKeys(page), []);

  // A new school date must refetch instead of displaying yesterday's cached query.
  await page.clock.install({ time: new Date("2026-09-27T22:30:00Z") });
  const sunday = { ...selectedEntry, id: selectedEntry.id + 10_000, day: "Sunday", occurrenceDate: "2026-09-27" };
  const monday = { ...selectedEntry, id: selectedEntry.id + 10_001, day: "Monday", occurrenceDate: "2026-09-28" };
  await setScheduleFixture(page, "feed", [sunday, monday]);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(`tr[data-schedule-id="${sunday.id}"]`).waitFor();
  assert.deepEqual(await visibleScheduleKeys(page), scheduleKeys([sunday]));
  await page.clock.setFixedTime(new Date("2026-09-27T23:30:00Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.locator(`tr[data-schedule-id="${monday.id}"]`).waitFor();
  assert.deepEqual(await visibleScheduleKeys(page), scheduleKeys([monday]));

  console.info(
    `eRegisters browser check passed: staff session, ${liveToday.length} due-today lessons, reload, rollover, empty/error/filter states, and register navigation.`,
  );
  await context.close();
} finally {
  await browser.close();
}