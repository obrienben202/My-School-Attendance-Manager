import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { HELP_TOPICS, getHelpPath, getHelpTopics } from "./staff-help.ts";

test("every guide has a unique address, steps and numbered visual callouts", () => {
  assert.equal(new Set(HELP_TOPICS.map(t => t.slug)).size, HELP_TOPICS.length);
  for (const topic of HELP_TOPICS) {
    assert.ok(topic.steps.length >= 3, topic.slug);
    assert.deepEqual(topic.callouts.map(c => c.number), [1, 2, 3]);
    assert.ok(topic.href.startsWith("/"), topic.slug);
    assert.ok(!topic.roles.includes("learner"));
  }
});

test("Help resolves detailed workspaces, query strings and unknown screens", () => {
  const routes = [
    ["/courses/16", "/help/courses"], ["/registers/12?date=2026-10-02", "/help/registers"],
    ["/staff/4/timetable", "/help/timetable"], ["/staff/4/register-history", "/help/registers"],
    ["/assessments/12", "/help/assessments"], ["/markbook/verification", "/help/markbook"],
    ["/ilp-admin/termly", "/help/termly-ilps"], ["/termly-ilps/staff", "/help/staff-ilp-comments"],
    ["/ilp-admin/groups", "/help/ilp-management"], ["/help/courses", "/help"],
    ["/", "/help/dashboard"], ["/missing", "/help/getting-started"],
  ];
  for (const [path, expected] of routes) assert.equal(getHelpPath(path, "admin"), expected);
});

test("role filtering never offers restricted or learner-accessible staff topics", () => {
  assert.deepEqual(getHelpTopics("learner"), []);
  assert.equal(getHelpPath("/courses", "learner"), "/learner-ilps");
  assert.equal(getHelpPath("/admin/sync", "staff"), "/help/getting-started");
  assert.equal(getHelpPath("/ilp-admin/termly", "hod"), "/help/getting-started");
  assert.equal(getHelpPath("/ilp-tutor/reviews", "office"), "/help/getting-started");
  for (const role of ["admin", "hod", "staff", "office"] as const) {
    assert.ok(getHelpTopics(role).some(t => t.slug === "staff-ilp-comments"));
    assert.ok(getHelpTopics(role).some(t => t.slug === "registers"));
  }
});

test("every topic has a self-contained image without live external assets", () => {
  for (const topic of HELP_TOPICS) {
    const path = new URL(`../../public/${topic.image}`, import.meta.url);
    assert.ok(existsSync(path), topic.slug);
    const svg = readFileSync(path, "utf8");
    assert.match(svg, /<svg\b/);
    assert.doesNotMatch(svg, /(?:href|src)=["']https?:\/\//);
  }
});