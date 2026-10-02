import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import { PAGES } from "../../../../staff-guide/src/pages.mjs";

const guide = new URL("../../../../staff-guide/", import.meta.url);
const read = (file: string) => readFileSync(new URL(file, guide), "utf8");

test("all original guide subjects have separate readable pages and working local links", () => {
  assert.equal(PAGES.length, 31);
  assert.equal(new Set(PAGES.map(p => p.slug)).size, PAGES.length);
  const titles = new Set<string>();
  for (const filename of ["index.html", ...PAGES.map(p => `${p.slug}.html`)]) {
    const html = read(filename);
    const title = html.match(/<title>(.*?)<\/title>/)?.[1];
    assert.ok(title && !titles.has(title), filename);
    titles.add(title);
    assert.equal((html.match(/<h1\b/g) ?? []).length, 1, filename);
    assert.match(html, /<meta name="description"/);
    for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const href = match[1];
      if (/^(?:https?:|mailto:|#)/.test(href)) continue;
      const target = new URL(href, new URL(filename, guide));
      assert.ok(target.pathname.startsWith(guide.pathname), `${filename}: ${href}`);
      assert.ok(existsSync(fileURLToPath(target)), `${filename}: ${href}`);
    }
  }
  for (const page of PAGES) {
    assert.ok(read(`${page.slug}.html`).includes(page.body), page.slug);
    assert.ok(read("index.html").includes(`href="${page.slug}.html"`), page.slug);
  }
  assert.doesNotMatch(read("index.html"), /Publish for all learners|Clone as new draft version/);
  for (const instruction of ["Publish for all learners", "Preview publication", "Only show missing account or RG teacher", "Save comment", "Complete review", "Return to learner", "Discuss with my RG teacher"]) {
    assert.ok(PAGES.some(p => p.body.includes(instruction)), instruction);
  }
});

test("guide search finds specific topics, handles no matches and resets; menu and printing work", () => {
  const element = (attributes: Record<string, string> = {}) => ({
    hidden: false, value: "", textContent: "", focused: false,
    attributes, events: {} as Record<string, () => void>,
    addEventListener(name: string, handler: () => void) { this.events[name] = handler; },
    getAttribute(name: string) { return this.attributes[name]; },
    setAttribute(name: string, value: string) { this.attributes[name] = value; },
    focus() { this.focused = true; },
  });
  const items = PAGES.map(p => element({ "data-search": `${p.title} ${p.desc} ${p.keywords} ${p.group}`.toLowerCase() }));
  const groups = [...new Set(PAGES.map(p => p.group))].map(group => ({
    hidden: false,
    querySelector() { return items.find((item, i) => PAGES[i].group === group && !item.hidden) ?? null; },
  }));
  const ids = Object.fromEntries(["menu-btn", "guide-nav", "q", "no-results", "q-status", "q-reset", "q-reset2"].map(id => [id, element()]));
  let menuOpen = false, printed = 0;
  const nav = Object.assign(ids["guide-nav"], { classList: { toggle() { menuOpen = !menuOpen; return menuOpen; } } });
  const print = element();
  vm.runInNewContext(read("guide.js"), {
    document: {
      getElementById(id: string) { return id === "guide-nav" ? nav : ids[id]; },
      querySelectorAll(selector: string) { return selector === "[data-item]" ? items : selector === "[data-group]" ? groups : [print]; },
    },
    window: { print() { printed++; } },
  });
  ids.q.value = "publish term";
  ids.q.events.input();
  assert.ok(items.some((item, i) => !item.hidden && PAGES[i].slug === "publish-term"));
  assert.equal(ids["no-results"].hidden, true);
  ids.q.value = "zzzz-no-match";
  ids.q.events.input();
  assert.ok(items.every(item => item.hidden));
  assert.ok(groups.every(group => group.hidden));
  assert.equal(ids["no-results"].hidden, false);
  assert.equal(ids["q-status"].textContent, "0 topics found");
  ids["q-reset2"].events.click();
  assert.equal(ids.q.value, "");
  assert.equal(ids.q.focused, true);
  assert.ok(items.every(item => !item.hidden));
  ids["menu-btn"].events.click();
  assert.equal(ids["menu-btn"].attributes["aria-expanded"], "true");
  ids["menu-btn"].events.click();
  assert.equal(ids["menu-btn"].attributes["aria-expanded"], "false");
  print.events.click();
  assert.equal(printed, 1);
});