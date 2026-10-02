// Renders staff-guide/*.html from src/pages.mjs. Run from anywhere: node staff-guide/src/build.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { GROUPS, PAGES as RAW } from "./pages.mjs";

const out = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = [...RAW].sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group));
const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const slugs = new Set(PAGES.map((p) => p.slug));
if (slugs.size !== PAGES.length) throw new Error("duplicate slug");

const nav = (cur) => GROUPS.map((g) => {
  const items = PAGES.filter((p) => p.group === g);
  const open = items.some((p) => p.slug === cur);
  return `<details class="nav-group"${open ? " open" : ""}><summary>${g}</summary><ul>${items.map((p) => `<li><a href="${p.slug}.html"${p.slug === cur ? ' aria-current="page"' : ""}>${p.title}</a></li>`).join("")}</ul></details>`;
}).join("");

const shell = (title, cur, crumbs, main, extraBody = "") => `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(cur === "index" ? "Find staff portal instructions by topic, including sign-in, courses, attendance, printing and termly ILP reviews." : PAGES.find(p => p.slug === cur)?.desc ?? title)}">
<link rel="stylesheet" href="guide.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="top">
  <a class="brand" href="index.html"><span class="mark" aria-hidden="true">AT</span><span><strong>Attendance Manager</strong><small>Staff Guide</small></span></a>
  <button type="button" class="menu-btn" aria-expanded="false" aria-controls="guide-nav" id="menu-btn">All topics</button>
</header>
<div class="layout">
  <nav class="side" id="guide-nav" aria-label="All guide topics"><a class="all" href="index.html"${cur === "index" ? ' aria-current="page"' : ""}>Guide contents</a>${nav(cur)}</nav>
  <main id="main" tabindex="-1">
${crumbs}
${main}
    <footer class="foot"><span>My School Attendance Manager &nbsp;&middot;&nbsp; Staff Guide 2024/25</span><span>my-school-attendance-manager.replit.app</span></footer>
  </main>
</div>
<script src="guide.js"></script>${extraBody}
</body>
</html>
`;

PAGES.forEach((p, i) => {
  const prev = PAGES[i - 1], next = PAGES[i + 1];
  const crumbs = `<nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="index.html">Staff Guide</a></li><li>${p.group}</li><li aria-current="page">${p.title}</li></ol></nav>`;
  const main = `<article>
<p class="eyebrow">${p.group}</p>
<h1>${p.title}</h1>
${p.body}
</article>
<nav class="pager" aria-label="Previous and next topics">${prev ? `<a class="prev" href="${prev.slug}.html"><small>Previous</small>${prev.title}</a>` : "<span></span>"}${next ? `<a class="next" href="${next.slug}.html"><small>Next</small>${next.title}</a>` : "<span></span>"}</nav>
<p class="print-btn-row"><button type="button" class="print-btn" data-print>Print this topic</button> <a href="index.html">Back to guide contents</a></p>`;
  writeFileSync(join(out, `${p.slug}.html`), shell(`${p.title} - Staff Guide - Attendance Manager`, p.slug, crumbs, main));
});

const idx = `<section class="hero"><p class="eyebrow">Staff Guide - 2024 / 25</p><h1>My School Attendance Manager: Staff Guide</h1><p class="lead">Pick a topic, or search by what you want to do. Each topic has its own page and prints on its own.</p>
<form class="search" role="search" onsubmit="return false"><label for="q">Search the guide</label><div class="row"><input id="q" type="search" placeholder="For example: print timetable, publish term, password" autocomplete="off"><button type="button" id="q-reset">Clear</button></div><p id="q-status" class="sr-live" role="status" aria-live="polite"></p></form></section>
<p id="no-results" class="empty" hidden><strong>No topics match your search.</strong> Try fewer or different words, or <button type="button" id="q-reset2">clear the search</button> to see all ${PAGES.length} topics.</p>
${GROUPS.map((g) => `<section class="group" data-group><h2>${g}</h2><ul class="cards">${PAGES.filter((p) => p.group === g).map((p) => `<li data-item data-search="${esc((p.title + " " + p.desc + " " + p.keywords + " " + g).toLowerCase())}"><a href="${p.slug}.html"><strong>${p.title}</strong><span>${p.desc}</span></a></li>`).join("")}</ul></section>`).join("\n")}`;
writeFileSync(join(out, "index.html"), shell("Staff Guide - Attendance Manager", "index", "", idx));
console.log(PAGES.length + 1, "pages written");
