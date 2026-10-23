import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const baseUrl = new URL(process.env.E2E_BASE_URL || "http://localhost/");
const username = process.env.E2E_ADMIN_USERNAME;
const password = process.env.E2E_ADMIN_PASSWORD;
const chromiumPath = process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium";
const courseId = 990074;

if (!username || !password) {
  throw new Error("Set E2E_ADMIN_USERNAME and E2E_ADMIN_PASSWORD in Replit Secrets to run the timetable form check.");
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

  // Authenticate against the real service; only the test course and its slots are controlled.
  await page.goto(new URL("/", baseUrl).toString(), { waitUntil: "domcontentloaded" });
  await page.locator('input[autocomplete="username"]').fill(username);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForFunction(async () => {
    const response = await fetch("/api/auth/user", { credentials: "include", cache: "no-store" });
    return response.ok && (await response.json()).user?.role === "admin";
  }, null, { timeout: 45_000 });
  await page.getByRole("link", { name: "eRegisters", exact: true }).waitFor();

  let slots = [];
  let listReads = 0;
  let createAttempts = 0;
  let editAttempts = 0;
  const submitted = { create: [], edit: [] };
  const issues = [
    { path: ["day"], message: "Day must be Monday, Tuesday, Wednesday, Thursday or Friday" },
    { path: ["startTime"], message: "Invalid time" },
  ];
  await page.route(new RegExp(`/api/courses/${courseId}(?:/|$)`), async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    const json = (status, body) => route.fulfill({
      status, contentType: "application/json", body: JSON.stringify(body),
    });
    if (path === `/api/courses/${courseId}` && method === "GET") {
      return json(200, {
        id: courseId, code: "E2E-SLOTS", name: "Timetable form check",
        enrolledCount: 0, isActive: true, createdAt: "2026-01-01T00:00:00.000Z",
      });
    }
    if (path === `/api/courses/${courseId}/students` && method === "GET") return json(200, []);
    if (path === `/api/courses/${courseId}/slots`) {
      if (method === "GET") {
        listReads++;
        return json(200, slots);
      }
      if (method === "POST") {
        submitted.create.push(request.postDataJSON());
        if (++createAttempts === 1) return json(400, { error: "Invalid body", issues });
        const slot = { ...submitted.create.at(-1), id: 991074, courseId };
        slots = [slot];
        return json(201, slot);
      }
    }
    if (path === `/api/courses/${courseId}/slots/991074` && method === "PUT") {
      submitted.edit.push(request.postDataJSON());
      if (++editAttempts === 1) return json(400, {
        error: "Invalid body",
        issues: [
          { path: ["day"], message: "Day must be Monday, Tuesday, Wednesday, Thursday or Friday" },
          { path: ["room"], message: "Room is invalid" },
        ],
      });
      slots = [{ ...slots[0], ...submitted.edit.at(-1) }];
      return json(200, slots[0]);
    }
    throw new Error(`Unexpected timetable request: ${method} ${path}`);
  });

  await page.goto(new URL(`/courses/${courseId}`, baseUrl).toString(), { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Timetable Slots", exact: true }).click();
  await page.getByRole("button", { name: "Add timetable slot" }).click();
  const newSlot = page.getByText("New Slot", { exact: true }).locator("..");
  await newSlot.getByText("Day", { exact: true }).locator("..").locator("select").selectOption("Friday");
  await newSlot.getByText("Start time", { exact: true }).locator("..").locator("input").fill("08:30");
  await newSlot.getByText("End time", { exact: true }).locator("..").locator("input").fill("09:30");
  await newSlot.getByPlaceholder("e.g. B12").fill("B14");
  await newSlot.getByText("Week pattern", { exact: true }).locator("..").locator("select").selectOption("Week A only");
  const beforeCreate = listReads;
  await newSlot.getByRole("button", { name: "Save slot" }).click();
  await newSlot.getByRole("alert").waitFor();
  assert.match(await newSlot.getByRole("alert").textContent(), /Day:.*Start time:/);
  assert.equal(listReads, beforeCreate, "failed create must not refresh the slot list");
  assert.equal(await newSlot.locator("select").first().inputValue(), "Friday");
  assert.equal(await newSlot.locator('input[type="time"]').first().inputValue(), "08:30");
  assert.equal(await newSlot.getByPlaceholder("e.g. B12").inputValue(), "B14");
  assert.equal(await newSlot.locator("select").last().inputValue(), "Week A only");

  await newSlot.getByRole("button", { name: "Save slot" }).click();
  await page.getByRole("button", { name: "Add timetable slot" }).waitFor();
  await page.getByRole("button", { name: "Timetable Slots (1)" }).waitFor();
  assert.equal(await page.getByRole("alert").count(), 0, "create error should clear after retry");
  assert.deepEqual(submitted.create, [submitted.create[0], submitted.create[0]], "retry should send retained values");
  assert.deepEqual(submitted.create[0], {
    day: "Friday", startTime: "08:30", endTime: "09:30", room: "B14", weekPattern: "Week A only",
  });
  assert.ok(listReads > beforeCreate, "successful create must refetch the slot list");

  const row = page.locator("table tbody tr").filter({ hasText: "B14" });
  await row.getByRole("button", { name: "Edit" }).click();
  const editRow = page.locator("table tbody tr.bg-teal-50").first();
  await editRow.locator("select").first().selectOption("Tuesday");
  await editRow.locator('input[type="time"]').first().fill("11:15");
  await editRow.locator('input[type="time"]').last().fill("12:15");
  await editRow.getByPlaceholder("Room").fill("C21");
  await editRow.locator("select").last().selectOption("Week B only");
  const beforeEdit = listReads;
  await editRow.getByRole("button", { name: "Save" }).click();
  await page.getByRole("alert").getByText(/Day:.*Room:/).waitFor();
  assert.equal(listReads, beforeEdit, "failed edit must not refresh the slot list");
  assert.equal(await editRow.locator("select").first().inputValue(), "Tuesday");
  assert.equal(await editRow.locator('input[type="time"]').first().inputValue(), "11:15");
  assert.equal(await editRow.locator('input[type="time"]').last().inputValue(), "12:15");
  assert.equal(await editRow.getByPlaceholder("Room").inputValue(), "C21");
  assert.equal(await editRow.locator("select").last().inputValue(), "Week B only");

  await editRow.getByRole("button", { name: "Save" }).click();
  await page.locator("table tbody tr").filter({ hasText: "C21" }).waitFor();
  assert.equal(await page.getByRole("alert").count(), 0, "edit error should clear after retry");
  assert.deepEqual(submitted.edit, [submitted.edit[0], submitted.edit[0]], "edit retry should send retained values");
  assert.deepEqual(submitted.edit[0], {
    day: "Tuesday", startTime: "11:15", endTime: "12:15", room: "C21", weekPattern: "Week B only",
  });
  assert.ok(listReads > beforeEdit, "successful edit must refetch the slot list");
  assert.ok((await page.locator("table tbody tr").filter({ hasText: "C21" }).textContent()).includes("Tuesday"));
  console.log("Signed-in timetable create and edit retries retained input, cleared errors, and refreshed slots.");
} finally {
  await browser.close();
}