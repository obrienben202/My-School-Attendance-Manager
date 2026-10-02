// SVG authoring helpers for guide illustrations. Scenes register anchors with A(); markers are drawn at those anchors.
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const C = { teal: "#458980", tealD: "#32776f", navy: "#1f3358", ink: "#1d2a44", mute: "#5d6b7b", line: "#d7dfe6", tint: "#e1efec", orange: "#c2410c", amber: "#f3e3c0" };
export const NAV = ["Staff Help Guide", "Dashboard", "My Courses", "eRegisters", "Markbook", "My Assessments", "My Assignments / Groups", "Targets", "ILP Tutor", "ILP Admin", "Reports", "Schedules", "Safeguarding", "eProgressions Hub", "Concierge", "Department Timetable", "User Management", "Data Sync"];
export const navY = (l) => 76 + NAV.indexOf(l) * 22;
export const t = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-size="${o.sz ?? 12}" font-weight="${o.w ?? 400}" fill="${o.c ?? C.ink}"${o.a ? ` text-anchor="${o.a}"` : ""}>${esc(s)}</text>`;
export const box = (x, y, w, h, o = {}) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.r ?? 6}" fill="${o.f ?? "#fff"}" stroke="${o.s ?? C.line}"${o.sw ? ` stroke-width="${o.sw}"` : ""}${o.d ? ` stroke-dasharray="${o.d}"` : ""}/>`;
export const btn = (x, y, w, h, label, primary = true) => box(x, y, w, h, { f: primary ? C.teal : "#fff", s: primary ? C.teal : "#b9c6d0", r: 5 }) + t(x + w / 2, y + h / 2 + 4, label, { w: 600, c: primary ? "#fff" : C.ink, a: "middle" });
export const pill = (x, y, w, label, f = C.tint, c = C.tealD) => box(x, y, w, 18, { f, s: f, r: 9 }) + t(x + w / 2, y + 13, label, { sz: 10.5, w: 600, c, a: "middle" });
export const field = (x, y, w, label, val = "", sel = false) => t(x, y - 5, label, { sz: 10.5, c: C.mute, w: 600 }) + box(x, y, w, 26, { f: "#f7f9fa", r: 4 }) + (val ? t(x + 8, y + 17, val, { c: val.startsWith("(") ? C.mute : C.ink }) : "") + (sel ? `<path d="M${x + w - 18} ${y + 10}l5 6 5-6z" fill="${C.mute}"/>` : "");
export const check = (x, y, label, on = false) => box(x, y, 14, 14, { r: 3, s: "#8a99a8", f: on ? C.teal : "#fff" }) + t(x + 22, y + 12, label);
export const tabs = (x, y, names, active) => names.map((n, i) => { const w = n.length * 8 + 28, px = x + names.slice(0, i).reduce((a, m) => a + m.length * 8 + 36, 0); return box(px, y, w, 28, { f: n === active ? C.teal : "#fff", r: 5 }) + t(px + w / 2, y + 19, n, { w: 700, c: n === active ? "#fff" : C.ink, a: "middle" }); }).join("");
export function table(x, y, cols, rows, rh = 32) {
  const w = cols.reduce((a, c) => a + c[1], 0);
  let s = box(x, y, w, 30 + rows.length * rh) + `<rect x="${x}" y="${y}" width="${w}" height="30" rx="6" fill="#e8f0ee"/>`, cx = x;
  cols.forEach(([l, cw]) => { s += t(cx + 10, y + 20, l, { sz: 11, w: 700, c: C.tealD }); cx += cw; });
  rows.forEach((r, i) => { cx = x; const ry = y + 30 + i * rh; s += `<line x1="${x}" x2="${x + w}" y1="${ry}" y2="${ry}" stroke="${C.line}"/>`; cols.forEach(([, cw], j) => { s += t(cx + 10, ry + rh / 2 + 4, r[j] ?? ""); cx += cw; }); });
  return s;
}
export function grid(x, y, w, days, slots, cells, rh = 44) {
  const cw = (w - 60) / days.length; let s = box(x, y, w, 26 + slots.length * rh);
  days.forEach((d, i) => { s += t(x + 60 + i * cw + cw / 2, y + 18, d, { sz: 11, w: 700, c: C.tealD, a: "middle" }); });
  slots.forEach((sl, r) => { s += `<line x1="${x}" x2="${x + w}" y1="${y + 26 + r * rh}" y2="${y + 26 + r * rh}" stroke="${C.line}"/>` + t(x + 6, y + 26 + r * rh + 16, sl, { sz: 10.5, c: C.mute }); });
  cells.forEach(([c, r, span, lab, col]) => { s += `<rect x="${x + 62 + c * cw}" y="${y + 29 + r * rh}" width="${cw - 6}" height="${span * rh - 6}" rx="4" fill="${col ?? "#dcebe8"}"/>` + t(x + 68 + c * cw, y + 46 + r * rh, lab, { sz: 10.5, w: 600 }); });
  return s;
}
const wrap = (inner, title, h) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 ${h}" font-family="system-ui,Segoe UI,sans-serif" role="img"><title>${esc(title)}</title><rect width="960" height="${h}" fill="#f4f7f6"/>${inner}</svg>`;
export function appShell(nav, title, crumb) {
  let s = `<rect width="160" height="470" fill="${C.navy}"/><rect x="12" y="12" width="28" height="28" rx="6" fill="${C.teal}"/>` + t(18, 31, "AT", { w: 700, c: "#fff" }) + t(48, 31, "Attendance", { w: 700, c: "#fff" });
  NAV.forEach((l) => { const y = navY(l); s += (l === nav ? `<rect x="6" y="${y - 14}" width="148" height="19" rx="4" fill="${C.teal}"/>` : "") + t(14, y, l, { sz: 10.5, c: "#e6eef5", w: l === nav ? 700 : 400 }); });
  s += `<rect x="160" width="800" height="68" fill="#fff"/><line x1="160" x2="960" y1="68" y2="68" stroke="${C.line}"/>` + t(180, 28, `Home / ${crumb ?? title}`, { sz: 11, c: C.mute }) + t(180, 54, title, { sz: 20, w: 700 });
  s += `<rect x="780" y="20" width="28" height="28" rx="6" fill="#fff" stroke="#c9d3dc"/><circle cx="794" cy="34" r="5" fill="${C.mute}"/><rect x="816" y="20" width="28" height="28" rx="6" fill="#fff" stroke="#c9d3dc"/>` + t(830, 40, "?", { sz: 15, w: 700, a: "middle" }) + `<rect x="852" y="20" width="28" height="28" rx="6" fill="#fff" stroke="#c9d3dc"/><path d="M861 38h10l-2-3v-4a3 3 0 0 0-6 0v4z" fill="${C.mute}"/><rect x="890" y="18" width="62" height="32" rx="8" fill="#fff" stroke="#c9d3dc"/><circle cx="906" cy="34" r="11" fill="${C.tint}"/>` + t(906, 38, "EX", { sz: 9, w: 700, c: C.tealD, a: "middle" }) + `<path d="M932 32l4 5 4-5z" fill="${C.mute}"/>`;
  return s;
}
export const ANCH = { bell: [866, 22], account: [892, 20], help: [830, 22], sidebar: (l) => [8, navY(l) - 14] };
/** Build a finished SVG. kind: app | plain. callouts: [{anchor|at, title}] where anchors come from scene.a */
export function render(scene) {
  const A = {}; const reg = (id, x, y) => { A[id] = [x, y]; return ""; };
  const body = scene.draw({ A: reg, t, box, btn, pill, field, check, tabs, table, grid, C, navY, ANCH });
  const kind = scene.kind ?? "app", H = 470 + 28 + 26 * scene.callouts.length + 26;
  let s = kind === "app" ? appShell(scene.nav, scene.title, scene.crumb) : kind === "login" ? `<rect width="960" height="470" fill="#0f172a"/>` : `<rect width="960" height="470" fill="#f4f7f6"/>`;
  s += body;
  s += `<rect x="0" y="470" width="960" height="${H - 470}" fill="#fff" stroke="${C.line}"/>` + t(20, 494, "Illustrated example \u2014 no live learner data", { sz: 13, w: 700, c: C.navy });
  scene.callouts.forEach((c, i) => {
    const [px, py] = c.at ?? A[c.anchor] ?? (() => { throw new Error(`missing anchor ${c.anchor} in ${scene.title}`); })();
    const ly = 520 + i * 26;
    s += `<g><circle cx="${px}" cy="${py}" r="12" fill="${C.orange}" stroke="#fff" stroke-width="2"/>` + t(px, py + 4.5, i + 1, { sz: 13, w: 700, c: "#fff", a: "middle" }) + `</g>`;
    s += `<circle cx="28" cy="${ly - 4}" r="10" fill="${C.orange}"/>` + t(28, ly, i + 1, { sz: 11, w: 700, c: "#fff", a: "middle" }) + t(48, ly, c.title, { sz: 13 });
  });
  return wrap(s, `${scene.title} - illustrated example`, H);
}
