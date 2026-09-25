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
  assert.ok(
    liveFeed.length > 0,
    "use a staff test account with at least one active assigned lesson to check register navigation",
  );

  await page.locator("tbody tr[data-schedule-id]").first().waitFor();
  assert.deepEqual(
    await visibleScheduleKeys(page),
    scheduleKeys(liveFeed),
    "the signed-in page should show exactly the active schedule feed returned for this staff account",
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

  const initialKeys = scheduleKeys(liveFeed);
  const reloadScheduleResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/schedule/today",
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  const reloadResponse = await reloadScheduleResponse;
  assert.equal(reloadResponse.status(), 200, "the session should survive a page reload");
  const reloadedFeed = await reloadResponse.json();
  assert.deepEqual(scheduleKeys(reloadedFeed), initialKeys);
  await page.locator("tbody tr[data-schedule-id]").first().waitFor();
  assert.deepEqual(await visibleScheduleKeys(page), initialKeys);

  const selectedEntry = liveFeed[0];
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
  await expectDetailRoute(page, openEntry);

  const submittedEntry = { ...selectedEntry, registerStatus: "submitted" };
  await setScheduleFixture(page, "feed", [submittedEntry]);
  await page.goto(new URL("/attendance", baseUrl).toString(), {
    waitUntil: "domcontentloaded",
  });
  const submittedRow = page.locator(
    `tr[data-schedule-id="${submittedEntry.id}"][data-occurrence-date="${submittedEntry.occurrenceDate}"]`,
  );
  await submittedRow.getByRole("button", { name: "Edit Attendance" }).click();
  await expectDetailRoute(page, submittedEntry);

  console.info(
    `eRegisters browser check passed: staff session, ${liveFeed.length} live assigned lessons, reload, empty/error/filter states, and register navigation.`,
  );
  await context.close();
} finally {
  await browser.close();
}