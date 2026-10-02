// Generates illustrated-example SVGs for each help topic with topic-specific screens and anchored markers.
// Run: node --experimental-strip-types scripts/gen-help-svgs.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { HELP_TOPICS } from "../src/lib/staff-help.ts";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const TEAL = "#458980", NAVY = "#1f3358", INK = "#1d2a44", MUTE = "#5d6b7b", LINE = "#d7dfe6", ORANGE = "#c2410c";
const NAV = ["Staff Help Guide", "Dashboard", "My Courses", "eRegisters", "Markbook", "Markbook Verification", "My Assessments", "My Assignments / Groups", "At Risk Learners", "Targets", "Planned Absence", "ILP Tutor", "Staff ILP comments", "ILP Admin", "Reports", "Schedules", "Safeguarding", "eProgressions Hub", "Concierge", "Department Timetable", "User Management", "Data Sync"];
const navY = (l) => 76 + NAV.indexOf(l) * 17;

const t = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-size="${o.sz ?? 12}" font-weight="${o.w ?? 400}" fill="${o.c ?? INK}"${o.a ? ` text-anchor="${o.a}"` : ""}>${esc(s)}</text>`;
const box = (x, y, w, h, o = {}) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.r ?? 6}" fill="${o.f ?? "#fff"}" stroke="${o.s ?? LINE}"/>`;
const btn = (x, y, w, h, label, primary = true) => box(x, y, w, h, { f: primary ? TEAL : "#fff", s: primary ? TEAL : "#b9c6d0", r: 5 }) + t(x + w / 2, y + h / 2 + 4, label, { sz: 12, w: 600, c: primary ? "#fff" : INK, a: "middle" });
const pill = (x, y, w, label, f = "#e1efec", c = "#32776f") => box(x, y, w, 18, { f, s: f, r: 9 }) + t(x + w / 2, y + 13, label, { sz: 10.5, w: 600, c, a: "middle" });
const input = (x, y, w, label, val = "") => t(x, y - 5, label, { sz: 10.5, c: MUTE, w: 600 }) + box(x, y, w, 26, { f: "#f7f9fa", r: 4 }) + (val ? t(x + 8, y + 17, val, { sz: 12 }) : "");
function table(x, y, cols, rows, rh = 32) {
  const w = cols.reduce((a, c) => a + c[1], 0);
  let s = box(x, y, w, 30 + rows.length * rh) + `<rect x="${x}" y="${y}" width="${w}" height="30" rx="6" fill="#e8f0ee"/>`, cx = x;
  cols.forEach(([l, cw]) => { s += t(cx + 10, y + 20, l, { sz: 11, w: 700, c: "#32776f" }); cx += cw; });
  rows.forEach((r, i) => { cx = x; const ry = y + 30 + i * rh; s += `<line x1="${x}" x2="${x + w}" y1="${ry}" y2="${ry}" stroke="${LINE}"/>`; cols.forEach(([, cw], j) => { s += t(cx + 10, ry + rh / 2 + 4, r[j] ?? "", { sz: 12 }); cx += cw; }); });
  return s;
}
const grid = (x, y, w, days, slots, cells) => {
  const cw = (w - 60) / days.length; let s = box(x, y, w, 26 + slots.length * 44);
  days.forEach((d, i) => { s += t(x + 60 + i * cw + cw / 2, y + 18, d, { sz: 11, w: 700, c: "#32776f", a: "middle" }); });
  slots.forEach((sl, r) => { s += `<line x1="${x}" x2="${x + w}" y1="${y + 26 + r * 44}" y2="${y + 26 + r * 44}" stroke="${LINE}"/>` + t(x + 6, y + 52 + r * 44, sl, { sz: 10.5, c: MUTE }); });
  cells.forEach(([c, r, span, lab, col]) => { s += `<rect x="${x + 62 + c * cw}" y="${y + 29 + r * 44}" width="${cw - 6}" height="${span * 44 - 6}" rx="4" fill="${col ?? "#dcebe8"}"/>` + t(x + 68 + c * cw, y + 50 + r * 44, lab, { sz: 10.5, w: 600 }); });
  return s;
};

// Each spec: nav (highlight), title, body (svg string), m: three [x,y] marker anchors.
const X = 180;
const S = {};
S["getting-started"] = { nav: "Staff Help Guide", title: "Staff Help Guide", m: [[150, navY("Dashboard") - 10], [860, 24], [940, 24]],
  body: t(X, 112, "Browse all available topics", { sz: 15, w: 700 }) + box(X, 126, 360, 30, { f: "#f7f9fa" }) + t(X + 10, 146, "Search topics", { c: MUTE }) +
    ["Getting started", "Dashboard", "My details", "Personal timetable"].map((n, i) => box(X + (i % 2) * 380, 172 + Math.floor(i / 2) * 76, 360, 62) + t(X + 14 + (i % 2) * 380, 196 + Math.floor(i / 2) * 76, n, { sz: 13, w: 700 }) + t(X + 14 + (i % 2) * 380, 216 + Math.floor(i / 2) * 76, "Open this topic", { sz: 11, c: MUTE })).join("") };
S.dashboard = { nav: "Dashboard", title: "Attendance Dashboard", m: [[X + 6, 106], [150, navY("eRegisters") - 10], [903, 24]],
  body: [["Attendance", "Overall figure"], ["Registers", "Work to complete"], ["Attention", "Needs review"]].map(([a, b], i) => box(X + i * 256, 100, 240, 84) + t(X + 14 + i * 256, 124, a, { sz: 11, w: 700, c: MUTE }) + t(X + 14 + i * 256, 156, "0.0%", { sz: 24, w: 700 }) + t(X + 14 + i * 256, 174, b, { sz: 10.5, c: MUTE })).join("") +
    t(X, 218, "Today's lessons", { sz: 14, w: 700 }) + table(X, 230, [["Course", 250], ["Time", 140], ["Register", 190], ["Status", 188]], [["Example course A", "09:00 - 10:00", "eRegisters", "Open"], ["Example course B", "10:15 - 11:15", "eRegisters", "Submitted"], ["Example course C", "13:00 - 14:00", "eRegisters", "Open"]]) };
S["my-details"] = { nav: "Staff Help Guide", title: "My Details", m: [[940, 24], [X + 8, 112], [X + 16, 314]],
  body: box(X + 560, 40, 0, 0, { f: "none", s: "none" }) + box(X, 100, 770, 150) + t(X + 16, 126, "Staff details", { sz: 14, w: 700 }) + input(X + 16, 150, 300, "Name", "Example staff member") + input(X + 340, 150, 200, "Username", "example.staff") + input(X + 16, 206, 300, "Role", "Staff") +
    box(X, 270, 770, 70) + t(X + 16, 296, "Weekly timetable", { sz: 14, w: 700 }) + btn(X + 16, 306, 130, 26, "My Timetable", true) };
S.timetable = { nav: "Staff Help Guide", title: "My Timetable", m: [[X + 6, 102], [X + 66, 142], [X + 6, 400]],
  body: btn(X, 90, 124, 28, "My Timetable") + btn(X + 690, 90, 80, 28, "Print", false) +
    grid(X, 126, 770, ["Mon", "Tue", "Wed", "Thu", "Fri"], ["09:00", "10:00", "11:00", "12:00", "13:00"], [[0, 0, 1, "Example course A"], [1, 1, 2, "Example course B", "#cfe0f0"], [2, 0, 1, "Example course A"], [3, 3, 1, "Example course C"], [4, 2, 1, "Week A / B", "#f3e3c0"]]) +
    box(X, 390, 770, 38) + t(X + 28, 413, "Additional sessions", { sz: 12, w: 700 }) + t(X + 190, 413, "Activity overlapping registration, break or lunch", { sz: 11, c: MUTE }) };
S.courses = { nav: "My Courses", title: "My Courses", m: [[X + 6, 106], [X + 6, 310], [X + 596, 104]],
  body: box(X, 100, 560, 120) + t(X + 14, 122, "Example course A", { sz: 14, w: 700 }) + t(X + 14, 140, "Course code and year group", { sz: 11, c: MUTE }) + t(X + 14, 176, "Example course B", { sz: 14, w: 700 }) + t(X + 14, 194, "Course code and year group", { sz: 11, c: MUTE }) +
    box(X, 236, 560, 120) + t(X + 14, 258, "Course links", { sz: 11, w: 700, c: MUTE }) + btn(X + 14, 270, 140, 28, "Enrolled Learners", false) + btn(X + 164, 270, 140, 28, "Timetable Slots", false) + btn(X + 314, 270, 140, 28, "Assessment Plan", false) +
    btn(X + 14, 312, 100, 26, "Export List", false) + btn(X + 124, 312, 130, 26, "Print Curriculum", false) +
    box(X + 580, 100, 190, 256) + t(X + 596, 122, "REPORTS", { sz: 10.5, w: 700, c: MUTE }) + ["Course Register (Master)", "Course Completion Report", "Retention Statistics"].map((r, i) => t(X + 596, 152 + i * 30, r, { sz: 10, c: "#32776f", w: 600 })).join("") };
S.registers = { nav: "eRegisters", title: "Mark Register", m: [[X + 6, 110], [X + 6, 232], [X + 620, 396]],
  body: box(X, 90, 770, 54) + t(X + 14, 112, "Example lesson - Example class", { sz: 14, w: 700 }) + t(X + 14, 132, "Date and session time", { sz: 11, c: MUTE }) + pill(X + 640, 108, 100, "Not submitted", "#f3e3c0", "#8a5a00") +
    t(X, 164, "Mark Register", { sz: 13, w: 700 }) + table(X, 174, [["Learner", 190], ["Present", 70], ["Absent", 70], ["Late", 60], ["Other Authorised", 140], ["Excluded", 80], ["Distance Learning", 160]],
      [["Example learner 1", "(x)", "", "", "", "", ""], ["Example learner 2", "", "(x)", "", "", "", ""], ["Example learner 3", "", "", "(x)", "", "", ""]], 32) +
    btn(X + 520, 380, 80, 30, "Save", false) + btn(X + 612, 380, 130, 30, "Submit Final", true) + t(X, 396, "Present 1  Absent 1  Late 1", { sz: 11, c: MUTE }) };
S.assessments = { nav: "My Assessments", title: "My Assessments", m: [[X + 6, 106], [X + 600, 106], [X + 700, 190]],
  body: table(X, 100, [["Course", 190], ["Code", 80], ["Description", 210], ["Due date", 110], ["Open", 180]], [["Example course A", "A1", "Example assessment 1", "Due date", "Marking screen"], ["Example course B", "A2", "Example assessment 2", "Due date", "Marking screen"], ["Example course A", "A3", "Example assessment 3", "Due date", "Marking screen"]], 36) +
    box(X, 270, 770, 70, { f: "#f7f9fa" }) + t(X + 14, 294, "On a course page, Assessment Plan lists saved assessments", { sz: 12, w: 600 }) + btn(X + 14, 304, 140, 26, "Assessment Plan", false) };
S.markbook = { nav: "Markbook", title: "Markbook", m: [[X + 6, 106], [X + 6, 196], [150, navY("Markbook") + 12]],
  body: t(X, 112, "Markbook", { sz: 15, w: 700 }) + table(X, 126, [["Learner", 200], ["Assessment 1", 130], ["Assessment 2", 130], ["Assessment 3", 130], ["Verified", 180]], [["Example learner 1", "Pass", "Merit", "-", "Not verified"], ["Example learner 2", "Merit", "Pass", "Pass", "Verified"], ["Example learner 3", "-", "-", "-", "Not verified"]], 36) +
    box(X, 290, 770, 50, { f: "#f7f9fa" }) + t(X + 14, 320, "Markbook Verification confirms results entered for your courses", { sz: 12 }) };
S.assignments = { nav: "My Assignments / Groups", title: "My Assignments / Groups", m: [[X + 6, 106], [X + 6, 150], [X + 690, 150]],
  body: [["Example group 1", "Example assignment 1"], ["Example group 2", "Example assignment 2"], ["Example group 3", "Example assignment 3"]].map(([g, a], i) => box(X, 100 + i * 62, 770, 52) + t(X + 16, 122 + i * 62, g, { sz: 13, w: 700 }) + t(X + 16, 140 + i * 62, a, { sz: 11, c: MUTE }) + btn(X + 640, 112 + i * 62, 110, 28, "Results", false)).join("") };
S.learners = { nav: "At Risk Learners", title: "Learners", m: [[X + 6, 112], [X + 16, 188], [X + 640, 188]],
  body: box(X, 90, 770, 40) + t(X + 14, 115, "Learner list", { sz: 13, w: 700 }) + table(X, 140, [["Learner", 250], ["Learner ID", 160], ["Year group", 160], ["Record", 200]], [["Example learner 1", "ID 0001", "Year 1", "Open record"], ["Example learner 2", "ID 0002", "Year 2", "Open record"], ["Example learner 3", "ID 0003", "Year 1", "Open record"]], 36) };
S.targets = { nav: "Targets", title: "Targets", m: [[150, navY("Targets") - 10], [X + 16, 182], [X + 640, 112]],
  body: t(X, 112, "Targets", { sz: 15, w: 700 }) + ["All", "Active", "Overdue"].map((label, i) => btn(X + 480 + i * 96, 94, 88, 28, label, i === 0)).join("") +
    ["Active", "Completed", "Overdue"].map((status, i) => box(X, 148 + i * 82, 770, 70) + t(X + 16, 174 + i * 82, "Example target", { sz: 14, w: 700 }) + t(X + 16, 198 + i * 82, "Example learner — target description", { sz: 11, c: MUTE }) + pill(X + 650, 164 + i * 82, 100, status)).join("") };
S["ilp-tutor"] = { nav: "ILP Tutor", title: "Reviews", m: [[150, navY("ILP Tutor") + 12], [X + 16, 108], [X + 400, 218]],
  body: ["All", "Open", "Submitted"].map((f, i) => btn(X + i * 96, 94, 88, 26, f, i === 0)).join("") + table(X, 132, [["Learner", 200], ["Course", 180], ["Review date", 120], ["Status", 100], ["Teacher comment", 170]], [["Example learner 1", "Example course A", "Review date", "Open", "Add comment"], ["Example learner 2", "Example course B", "Review date", "Submitted", "Added"]], 36) +
    box(X, 258, 770, 90, { f: "#f7f9fa" }) + t(X + 14, 282, "Teacher comment", { sz: 12, w: 700 }) + box(X + 14, 292, 740, 44, { f: "#fff", r: 4 }) + t(X + 24, 318, "Example comment text", { sz: 12, c: MUTE }) };
S["staff-ilp-comments"] = { nav: "ILP Tutor", title: "Staff ILP comments", m: [[X + 6, 112], [X + 16, 156], [X + 16, 290]],
  body: t(X, 112, "Staff ILP comments", { sz: 15, w: 700 }) + box(X, 126, 770, 60) + t(X + 16, 152, "Example learner", { sz: 13, w: 700 }) + t(X + 16, 170, "Review for the current term", { sz: 11, c: MUTE }) +
    box(X, 200, 770, 130) + t(X + 16, 224, "Staff comment", { sz: 12, w: 700 }) + box(X + 16, 234, 738, 50, { f: "#f7f9fa", r: 4 }) + btn(X + 640, 292, 114, 28, "Save", true) };
S["ilp-management"] = { nav: "ILP Admin", title: "ILP Admin", m: [[X + 6, 106], [X + 6, 242], [X + 396, 242]],
  body: t(X, 112, "ILP Admin", { sz: 15, w: 700 }) + [["Assigned ILPs", "Manage Learner ILPs"], ["Headers", "Groups"]].map((r, i) => r.map((l, j) => box(X + j * 390, 128 + i * 90, 380, 76) + t(X + 16 + j * 390, 160 + i * 90, l, { sz: 14, w: 700 }) + t(X + 16 + j * 390, 182 + i * 90, "Open this ILP Admin area", { sz: 11, c: MUTE })).join("")).join("") };
S["termly-ilps"] = { nav: "ILP Admin", title: "Termly ILPs", m: [[X + 30, 96], [X + 130, 96], [X + 214, 96]],
  body: ["People", "Templates", "Terms"].map((l, i) => box(X + i * 92, 90, 88, 30, { f: i === 0 ? TEAL : "#fff", r: 5 }) + t(X + 44 + i * 92, 110, l, { sz: 12, w: 700, c: i === 0 ? "#fff" : INK, a: "middle" })).join("") +
    table(X, 140, [["Person", 250], ["Role", 150], ["Linked account", 200], ["Status", 170]], [["Example staff", "Staff", "Linked", "Ready"], ["Example learner", "Learner", "Roster link needed", "Pending"]], 36) +
    t(X, 290, "Templates holds the review layout; Terms holds the termly review dates", { sz: 11, c: MUTE }) };
S["planned-absence"] = { nav: "Planned Absence", title: "Planned Absence", m: [[X + 6, 106], [X + 16, 170], [X + 640, 286]],
  body: t(X, 112, "Planned Absence", { sz: 15, w: 700 }) + box(X, 130, 770, 120) + input(X + 16, 160, 260, "Learner", "Example learner") + input(X + 300, 160, 150, "Start date", "Date") + input(X + 470, 160, 150, "End date", "Date") + input(X + 16, 214, 600, "Reason", "Example reason") + btn(X + 620, 274, 150, 28, "Submit request", true) };
S.reports = { nav: "Reports", title: "Reports", m: [[150, navY("Reports") - 10], [X + 16, 150], [X + 16, 292]],
  body: t(X, 112, "Reports", { sz: 15, w: 700 }) + ["Attendance report", "Course report", "Learner report"].map((r, i) => box(X, 126 + i * 50, 480, 42) + t(X + 16, 152 + i * 50, r, { sz: 13, w: 600 }) + btn(X + 380, 134 + i * 50, 90, 26, "Select", false)).join("") +
    box(X + 500, 126, 270, 140) + t(X + 516, 148, "Scope", { sz: 11, w: 700, c: MUTE }) + t(X + 516, 172, "Example course", { sz: 12 }) + btn(X + 516, 224, 100, 28, "Print", true) +
    t(X, 304, "Course report links and Print Curriculum are on course detail pages", { sz: 11, c: MUTE }) };
S.schedules = { nav: "Schedules", title: "Schedules", m: [[150, navY("Schedules") - 10], [150, navY("Department Timetable") - 10], [X + 396, 176]],
  body: t(X, 112, "Schedules", { sz: 15, w: 700 }) + table(X, 126, [["Course", 220], ["Day", 90], ["Time", 150], ["Room", 120], ["Week", 190]], [["Example course A", "Mon", "09:00 - 10:00", "Example room", "Week A"], ["Example course B", "Wed", "11:00 - 12:00", "Example room", "Week B"], ["Example course C", "Fri", "13:00 - 14:00", "Example room", "Week A / B"]], 36) };
S.safeguarding = { nav: "Safeguarding", title: "Safeguarding", m: [[150, navY("Safeguarding") - 10], [X + 16, 150], [X + 16, 262]],
  body: t(X, 112, "Safeguarding", { sz: 15, w: 700 }) + box(X, 126, 770, 54) + t(X + 16, 150, "Example learner", { sz: 13, w: 700 }) + t(X + 16, 168, "Check the identity before reading or adding information", { sz: 11, c: MUTE }) +
    box(X, 196, 770, 90, { f: "#fbf1ef", s: "#e6bcb4" }) + t(X + 16, 222, "Restricted records", { sz: 13, w: 700, c: "#8a2f20" }) + t(X + 16, 244, "Visible only to authorised roles and school process", { sz: 11, c: "#8a2f20" }) };
S.progressions = { nav: "eProgressions Hub", title: "eProgressions Hub", m: [[150, navY("eProgressions Hub") - 10], [X + 16, 150], [X + 650, 150]],
  body: t(X, 112, "eProgressions Hub", { sz: 15, w: 700 }) + table(X, 126, [["Learner", 250], ["Enrolment", 220], ["Progression", 150], ["Action", 150]], [["Example learner 1", "Example course A", "In progress", "Open"], ["Example learner 2", "Example course B", "Submitted", "Open"]], 36) };
S.concierge = { nav: "Concierge", title: "Concierge", m: [[150, navY("Concierge") - 10], [X + 6, 190], [X + 396, 190]],
  body: t(X, 112, "Concierge", { sz: 15, w: 700 }) + [["Applicants", "Interviews"], ["Applications", "Enrolments"]].map((r, i) => r.map((l, j) => box(X + j * 390, 128 + i * 90, 380, 76) + t(X + 16 + j * 390, 160 + i * 90, l, { sz: 14, w: 700 }) + t(X + 16 + j * 390, 182 + i * 90, "Open this Concierge area", { sz: 11, c: MUTE })).join("")).join("") };
S.users = { nav: "User Management", title: "User Management", m: [[150, navY("User Management") - 10], [X + 410, 144], [X + 606, 96]],
  body: t(X, 112, "User Management", { sz: 15, w: 700 }) + btn(X + 580, 94, 190, 28, "Sync from Google Sheet", true) + table(X, 130, [["Name", 220], ["Username", 190], ["Directory role", 180], ["Status", 180]], [["Example staff 1", "example.one", "Admin", "Active"], ["Example staff 2", "example.two", "Staff", "Active"], ["Example staff 3", "example.three", "Office", "Active"]], 36) };
S["data-sync"] = { nav: "Data Sync", title: "Data Sync", m: [[150, navY("Data Sync") - 10], [X + 16, 232], [X + 640, 96]],
  body: t(X, 112, "Data Sync", { sz: 22, w: 700 }) + btn(X + 640, 92, 130, 30, "Force sync", true) + t(X, 138, "Last refresh and automatic refresh every 15 minutes", { sz: 11, c: MUTE }) +
    box(X, 152, 770, 110) + t(X + 16, 178, "Course Sessions", { sz: 14, w: 700 }) + pill(X + 660, 164, 90, "Success", "#cfe8d6", "#276749") + t(X + 16, 202, "Source: Sessions sheet", { sz: 11 }) + t(X + 16, 222, "Result: rows read and courses refreshed", { sz: 11 }) + t(X + 16, 242, "Failed refresh keeps last saved schedules", { sz: 11, c: MUTE }) +
    box(X, 276, 770, 64) + t(X + 16, 302, "Directory role reconciliation", { sz: 14, w: 700 }) + t(X + 16, 322, "Status and errors", { sz: 11, c: MUTE }) };

S["staff-ilp-comments"].nav = "Staff ILP comments";
S.markbook.m[2] = [150, navY("Markbook Verification") - 6];
S.registers.m[1] = [X + 420, 208];
S.registers.body =
  box(X, 90, 770, 54) + t(X + 14, 112, "Example lesson — Example class", { sz: 14, w: 700 }) +
  t(X + 14, 132, "Check the lesson date and session time", { sz: 11, c: MUTE }) +
  t(X, 164, "Mark Register", { sz: 13, w: 700 }) +
  table(X, 174, [["Learner", 220], ["Person code", 120], ["Mark", 180], ["Notes", 250]], [
    ["Example learner 1", "EX001", "P — Present  v", ""],
    ["Example learner 2", "EX002", "A — Absent  v", ""],
    ["Example learner 3", "EX003", "L — Late  v", "Example note"],
  ], 42) +
  t(X, 350, "Check the marks and attendance totals before submitting.", { sz: 12, c: MUTE }) +
  btn(X + 500, 382, 110, 30, "Save", false) + btn(X + 630, 382, 140, 30, "Submit Final", true);

mkdirSync("public/help-guide", { recursive: true });
let n = 0;
for (const tp of HELP_TOPICS) {
  const sp = S[tp.slug];
  if (!sp) throw new Error("no illustration for " + tp.slug);
  if (sp.m.length !== tp.callouts.length) throw new Error("marker count mismatch " + tp.slug);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 600" font-family="system-ui,Segoe UI,sans-serif" role="img"><title>${esc(tp.title)} - illustrated example</title>`;
  s += `<rect width="960" height="600" fill="#f4f7f6"/><rect width="160" height="470" fill="${NAVY}"/><rect x="12" y="12" width="28" height="28" rx="6" fill="${TEAL}"/>` + t(18, 31, "AT", { sz: 12, w: 700, c: "#fff" }) + t(48, 31, "Attendance", { sz: 12, w: 700, c: "#fff" });
  NAV.forEach((l, i) => { const y = navY(l); s += (l === sp.nav ? `<rect x="6" y="${y - 12}" width="148" height="16" rx="4" fill="${TEAL}"/>` : "") + t(14, y, l, { sz: 9.3, c: "#e6eef5", w: l === sp.nav ? 700 : 400 }); });
  s += `<rect x="160" width="800" height="68" fill="#fff"/><line x1="160" x2="960" y1="68" y2="68" stroke="${LINE}"/>` + t(180, 28, `Home / ${tp.slug === "dashboard" ? "Attendance" : sp.title}`, { sz: 11, c: MUTE }) + t(180, 54, sp.title, { sz: 20, w: 700 });
  s += `<circle cx="815" cy="34" r="14" fill="#fff" stroke="#c9d3dc"/><circle cx="860" cy="34" r="14" fill="#fff" stroke="#c9d3dc"/>` + t(860, 39, "?", { sz: 15, w: 700, a: "middle" }) + `<circle cx="903" cy="34" r="14" fill="#fff" stroke="#c9d3dc"/><path d="M898 38h10l-2-3v-4a3 3 0 0 0-6 0v4z" fill="${MUTE}"/><rect x="926" y="20" width="28" height="28" rx="14" fill="#e1efec"/>` + t(940, 38, "EX", { sz: 10, w: 700, c: "#32776f", a: "middle" });
  s += sp.body;
  s += `<rect x="160" y="470" width="800" height="130" fill="#fff" stroke="${LINE}"/><rect x="0" y="470" width="160" height="130" fill="${NAVY}"/>` + t(180, 494, "Illustrated example - no live learner data", { sz: 13, w: 700, c: NAVY });
  tp.callouts.forEach((c, i) => {
    let [px, py] = sp.m[i];
    if (tp.slug === "getting-started" && i === 1) [px, py] = [860, 24];
    const ly = 520 + i * 24;
    s += `<g><circle cx="${px}" cy="${py}" r="12" fill="${ORANGE}" stroke="#fff" stroke-width="2"/>` + t(px, py + 4.5, c.number, { sz: 13, w: 700, c: "#fff", a: "middle" }) + `</g>`;
    s += `<circle cx="188" cy="${ly - 4}" r="9" fill="${ORANGE}"/>` + t(188, ly, c.number, { sz: 11, w: 700, c: "#fff", a: "middle" }) + t(204, ly, c.title, { sz: 13 });
  });
  writeFileSync(`public/${tp.image}`, s + "</svg>");
  n++;
}
console.log(n, "svgs");
