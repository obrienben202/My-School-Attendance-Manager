import assert from "node:assert/strict";
import { additionalExpectations, timetableFixture, weekdays } from "./my-timetable-fixtures.mjs";

export async function assertWeeklyContents(dialog) {
  const table = dialog.getByTestId("table-weekly-timetable");
  await table.waitFor();
  assert.deepEqual(await table.locator("thead th").allTextContents(), ["Lesson / Time", ...weekdays]);
  const rows = table.locator("tbody tr");
  assert.equal(await rows.count(), 9);
  for (const band of ["Form Time / Registration", "Break", "Lunch"]) {
    const row = rows.filter({ has: table.page().getByRole("rowheader", { name: new RegExp(band) }) });
    assert.equal(await row.locator('td[colspan="5"]').textContent(), band);
  }
  const lesson1 = rows.filter({ hasText: "Lesson 1" });
  for (const [index, day] of weekdays.entries()) {
    const cell = lesson1.locator("td").nth(index);
    await cell.getByText(`${day} fixture lesson`, { exact: true }).waitFor();
    assert.ok((await cell.textContent()).includes(index % 2 ? "Week A only" : "Week B only"));
  }
  const monday = lesson1.locator("td").first();
  const overlap = monday.getByTestId("row-timetable-day-0-5");
  await overlap.waitFor();
  assert.equal(await monday.locator('[data-testid^="row-timetable-"]').count(), 2);
  assert.ok((await overlap.textContent()).includes("09:10–09:40"));
  const firstBox = await monday.getByTestId("row-timetable-day-0-0").boundingBox();
  const secondBox = await overlap.boundingBox();
  assert.ok(firstBox && secondBox && secondBox.y >= firstBox.y + firstBox.height,
    "overlapping records must be separate, non-overlaid cards");
  const cross = table.getByTestId("row-timetable-cross-6");
  assert.equal(await cross.count(), 2, "cross-period session must appear in both lesson cells");
  for (const entry of await cross.all()) {
    assert.ok((await entry.textContent()).includes("11:30–12:30"));
    assert.ok((await entry.textContent()).includes("Spans periods"));
    assert.equal(await entry.evaluate(el => el.closest("td").cellIndex), 2, "cross-period session stays on Tuesday");
  }
  const additional = dialog.getByTestId("section-additional-timetable");
  assert.equal(await additional.locator("li").count(), additionalExpectations.length);
  for (const { index, reason } of additionalExpectations) {
    const entry = additional.getByTestId(`row-additional-${index}`);
    const fixture = timetableFixture[index];
    const text = await entry.textContent();
    for (const expected of [fixture.description, fixture.day, fixture.startTime || "Time not recorded", fixture.endTime, reason]) {
      assert.ok(text.includes(expected), `additional record ${index} must retain ${expected}`);
    }
  }
  assert.equal(await dialog.locator("script").count(), 0, "fixture markup must stay literal text");
}

export async function assertContained(page, dialog, mobile) {
  // Wait for Radix's opening transition before measuring the centered dialog.
  await dialog.evaluate(async el => {
    await Promise.all(el.getAnimations().map(animation => animation.finished));
  });
  const geometry = await dialog.evaluate(el => {
    const rect = el.getBoundingClientRect();
    const table = el.querySelector('[data-testid="table-weekly-timetable"]');
    const scroller = table.parentElement;
    return {
      left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
      viewportWidth: innerWidth, viewportHeight: innerHeight,
      dialogWidth: el.clientWidth, dialogScrollWidth: el.scrollWidth,
      pageWidth: document.documentElement.clientWidth, pageScrollWidth: document.documentElement.scrollWidth,
      scrollWidth: scroller.scrollWidth, clientWidth: scroller.clientWidth,
      overflow: getComputedStyle(scroller).overflowX,
    };
  });
  assert.ok(geometry.left >= -1 && geometry.right <= geometry.viewportWidth + 1, "dialog stays within viewport width");
  assert.ok(geometry.top >= -1 && geometry.bottom <= geometry.viewportHeight + 1, "dialog stays within viewport height");
  assert.ok(geometry.dialogScrollWidth <= geometry.dialogWidth + 1, "wide grid must not overflow dialog");
  assert.ok(geometry.pageScrollWidth <= geometry.pageWidth + 1, "grid must not cause page-level horizontal overflow");
  if (mobile) {
    assert.ok(geometry.scrollWidth > geometry.clientWidth, "mobile should preserve a horizontally scrollable weekly grid");
    assert.ok(["auto", "scroll"].includes(geometry.overflow));
    const table = dialog.getByTestId("table-weekly-timetable");
    await table.evaluate(el => { el.parentElement.scrollLeft = el.parentElement.scrollWidth; });
    const friday = await table.getByRole("columnheader", { name: "Friday", exact: true }).boundingBox();
    const scroller = await table.locator("..").boundingBox();
    assert.ok(friday && scroller && friday.x >= scroller.x - 1 && friday.x + friday.width <= scroller.x + scroller.width + 1,
      "Friday must be reachable inside the mobile scroller");
    await table.evaluate(el => { el.parentElement.scrollLeft = 0; });
  }
  assert.ok(await dialog.getByRole("button", { name: "Close", exact: true }).isVisible());
  assert.ok(await dialog.getByTestId("button-print-timetable").isVisible());
}

export async function timetableColors(dialog) {
  return dialog.evaluate(el => {
    // Canvas normalizes CSS colors (including OKLCH tokens) into sRGB and
    // composites translucent card backgrounds over the actual dialog color.
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const luminance = (foreground, background) => {
      context.clearRect(0, 0, 1, 1);
      for (const value of [getComputedStyle(el).backgroundColor, background, foreground].filter(Boolean)) {
        context.fillStyle = value;
        context.fillRect(0, 0, 1, 1);
      }
      const channels = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map(value => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const contrast = (text, background) => {
      const a = luminance(text, background);
      const b = luminance(null, background);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    };
    const color = selector => {
      const node = el.querySelector(selector);
      const style = getComputedStyle(node);
      return { color: style.color, background: style.backgroundColor };
    };
    return {
      dialog: getComputedStyle(el).backgroundColor,
      header: color("thead"),
      entry: color('[data-testid="row-timetable-day-0-0"]'),
      title: color('[data-testid="row-timetable-day-0-0"] p'),
      additional: color('[data-testid="row-additional-7"]'),
      textContrast: [...el.querySelectorAll('[data-testid="row-timetable-day-0-0"] p')].map(node =>
        contrast(getComputedStyle(node).color, getComputedStyle(node.parentElement).backgroundColor)),
    };
  });
}

export async function assertPrintOutput(popup) {
  await popup.waitForFunction(() => window.__timetablePrintCalled === true);
  await popup.emulateMedia({ media: "print" });
  const table = popup.getByRole("table", { name: "Weekly personal timetable" });
  assert.deepEqual(await table.locator("thead th").allTextContents(), ["Lesson / Time", ...weekdays]);
  assert.equal(await table.locator("tbody tr").count(), 9);
  assert.equal(await table.locator('td[colspan="5"]').count(), 3);
  const firstRow = table.locator("tbody tr").nth(1);
  for (const [index, day] of weekdays.entries()) {
    assert.ok((await firstRow.locator("td").nth(index).textContent()).includes(`${day} fixture lesson`));
  }
  assert.ok((await firstRow.locator("td").first().textContent()).includes("Overlapping fixture lesson"));
  const cross = table.locator("article").filter({ hasText: "Cross-period fixture lesson" });
  assert.equal(await cross.count(), 2);
  for (const entry of await cross.all()) assert.ok((await entry.textContent()).includes("11:30–12:30"));
  const extras = popup.locator("section .additional");
  assert.equal(await extras.count(), additionalExpectations.length);
  for (const [{ index, reason }, entry] of additionalExpectations.map((value, i) => [value, extras.nth(i)])) {
    const text = await entry.textContent();
    const fixture = timetableFixture[index];
    for (const expected of [fixture.description, fixture.day, fixture.startTime || "Time not recorded", fixture.endTime, reason]) {
      assert.ok(text.includes(expected), `print additional record ${index} must retain ${expected}`);
    }
  }
  assert.equal(await popup.locator("script, button").count(), 0);
  const geometry = await table.evaluate(el => {
    const rect = el.getBoundingClientRect();
    return {
      left: rect.left, right: rect.right, viewport: innerWidth,
      columns: [...el.querySelectorAll("thead th")].map(th => {
        const box = th.getBoundingClientRect();
        return { left: box.left, right: box.right, width: box.width };
      }),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      landscape: [...document.styleSheets].some(sheet => [...sheet.cssRules].some(rule =>
        rule.type === CSSRule.PAGE_RULE && /a4 landscape/i.test(rule.style.getPropertyValue("size")))),
    };
  });
  assert.ok(geometry.landscape, "print stylesheet must request A4 landscape");
  assert.ok(!geometry.overflow && geometry.left >= 0 && geometry.right <= geometry.viewport + 1);
  assert.ok(geometry.columns.every(column => column.width > 0 && column.left >= geometry.left - 1 && column.right <= geometry.right + 1),
    "all five weekday columns must fit the printed table without clipping");
  // Chromium's PDF renderer uses the actual @page rule, not just screen geometry.
  // Keep bytes in memory: no staff names, PDFs or auth state are written to disk.
  const pdf = (await popup.pdf({ preferCSSPageSize: true, printBackground: true })).toString("latin1");
  const boxes = [...pdf.matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)];
  assert.ok(boxes.length > 0, "PDF must contain measurable pages");
  for (const [, width, height] of boxes) {
    assert.ok(Math.abs(Number(width) - 842) < 3 && Math.abs(Number(height) - 595) < 3,
      "every PDF page must be A4 landscape");
  }
}
