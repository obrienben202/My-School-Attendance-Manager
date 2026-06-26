import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  FileText, Folder, FolderOpen, Search, Clock, ChevronRight,
  Printer, Mail, Eye, Filter, ChevronDown, ChevronUp, X,
} from "lucide-react";

// ─── Reference data ────────────────────────────────────────────────────────────

type ReportDef = {
  id: string;
  name: string;
  folder: string;
  description: string;
  filters: FilterField[];
  columns: string[];
  sampleRows: string[][];
};

type FilterField = {
  key: string;
  label: string;
  type: "text" | "select" | "date";
  options?: string[];
};

const FOLDER_STRUCTURE: { name: string; reports: string[] }[] = [
  {
    name: "Attendance",
    reports: ["att-overall", "att-learner", "att-course", "att-punctuality"],
  },
  {
    name: "Assessments",
    reports: ["asmt-grade-summary", "asmt-results", "asmt-unconfirmed"],
  },
  {
    name: "ILP",
    reports: ["ilp-progress", "ilp-reviews-due", "ilp-completion"],
  },
  {
    name: "Safeguarding",
    reports: ["sg-at-risk", "sg-planned-absence"],
  },
  {
    name: "Markbook",
    reports: ["mb-verification-status", "mb-grades-released"],
  },
];

const REPORTS: ReportDef[] = [
  {
    id: "att-overall",
    name: "Overall Attendance Summary",
    folder: "Attendance",
    description: "Summary of attendance figures across all courses for a given period.",
    filters: [
      { key: "academicYear", label: "Academic Year", type: "select", options: ["2024/25", "2023/24", "2022/23"] },
      { key: "dateFrom", label: "Date From", type: "date" },
      { key: "dateTo", label: "Date To", type: "date" },
      { key: "course", label: "Course", type: "select", options: ["All courses", "Level 3 BTEC", "GCSE English", "A Level Mathematics", "Access to HE"] },
    ],
    columns: ["Course", "Enrolled", "Avg Attendance %", "Below 80%", "Below 90%"],
    sampleRows: [
      ["Level 3 BTEC Extended Diploma", "48", "82.4%", "9", "18"],
      ["GCSE English Language", "32", "74.1%", "14", "22"],
      ["A Level Mathematics", "27", "88.6%", "3", "8"],
      ["Access to HE Science", "19", "91.2%", "1", "4"],
    ],
  },
  {
    id: "att-learner",
    name: "Learner Attendance Detail",
    folder: "Attendance",
    description: "Individual learner attendance breakdown by session.",
    filters: [
      { key: "academicYear", label: "Academic Year", type: "select", options: ["2024/25", "2023/24", "2022/23"] },
      { key: "surname", label: "Surname", type: "text" },
      { key: "course", label: "Course", type: "select", options: ["All courses", "Level 3 BTEC", "GCSE English", "A Level Mathematics"] },
      { key: "dateFrom", label: "Date From", type: "date" },
      { key: "dateTo", label: "Date To", type: "date" },
    ],
    columns: ["Learner", "Person Code", "Course", "Sessions Possible", "Sessions Attended", "Attendance %", "Punctuality %"],
    sampleRows: [
      ["Adams, James", "PC0012", "GCSE English Language", "42", "38", "90.5%", "94.7%"],
      ["Brown, Sarah", "PC0034", "Level 3 BTEC", "60", "44", "73.3%", "88.6%"],
      ["Clarke, Michael", "PC0051", "A Level Mathematics", "38", "35", "92.1%", "97.2%"],
      ["Davies, Emma", "PC0067", "Access to HE Science", "44", "40", "90.9%", "93.1%"],
      ["Evans, Liam", "PC0089", "GCSE English Language", "42", "29", "69.0%", "72.4%"],
    ],
  },
  {
    id: "att-course",
    name: "Course Attendance by Date",
    folder: "Attendance",
    description: "Session-by-session attendance for a specific course.",
    filters: [
      { key: "course", label: "Course", type: "select", options: ["Level 3 BTEC", "GCSE English", "A Level Mathematics", "Access to HE"] },
      { key: "dateFrom", label: "Date From", type: "date" },
      { key: "dateTo", label: "Date To", type: "date" },
    ],
    columns: ["Session Date", "Session", "Present", "Absent", "Late", "Attendance %"],
    sampleRows: [
      ["09/09/2024", "Mon AM", "28", "4", "2", "85.3%"],
      ["10/09/2024", "Tue PM", "30", "2", "1", "90.9%"],
      ["11/09/2024", "Wed AM", "26", "6", "3", "78.8%"],
    ],
  },
  {
    id: "att-punctuality",
    name: "Punctuality Report",
    folder: "Attendance",
    description: "Learners with persistent lateness patterns.",
    filters: [
      { key: "academicYear", label: "Academic Year", type: "select", options: ["2024/25", "2023/24"] },
      { key: "threshold", label: "Min late sessions", type: "select", options: ["3+", "5+", "10+"] },
    ],
    columns: ["Learner", "Person Code", "Course", "Total Sessions", "Late Sessions", "Late %"],
    sampleRows: [
      ["Brown, Sarah", "PC0034", "Level 3 BTEC", "60", "12", "20.0%"],
      ["Evans, Liam", "PC0089", "GCSE English", "42", "8", "19.0%"],
    ],
  },
  {
    id: "asmt-grade-summary",
    name: "Grade Summary by Course",
    folder: "Assessments",
    description: "Distribution of grades across assessments for a course.",
    filters: [
      { key: "course", label: "Course", type: "select", options: ["All courses", "Level 3 BTEC", "GCSE English", "A Level Mathematics"] },
      { key: "academicYear", label: "Academic Year", type: "select", options: ["2024/25", "2023/24"] },
    ],
    columns: ["Course", "Unit", "A* / Dist*", "A / Distinction", "B / Merit", "C / Pass", "U / Fail", "Not graded"],
    sampleRows: [
      ["Level 3 BTEC", "Unit 1: Research Methods", "5", "12", "18", "8", "2", "3"],
      ["Level 3 BTEC", "Unit 2: Data Analysis", "3", "10", "20", "10", "1", "4"],
      ["GCSE English", "Component 1", "2", "8", "11", "7", "3", "1"],
    ],
  },
  {
    id: "asmt-results",
    name: "Assessment Results Detail",
    folder: "Assessments",
    description: "Individual learner grades per assessment.",
    filters: [
      { key: "course", label: "Course", type: "select", options: ["All courses", "Level 3 BTEC", "GCSE English"] },
      { key: "unit", label: "Unit / Component", type: "text" },
      { key: "academicYear", label: "Academic Year", type: "select", options: ["2024/25", "2023/24"] },
    ],
    columns: ["Learner", "Person Code", "Unit", "Grade", "Score", "Verified", "Released"],
    sampleRows: [
      ["Adams, James", "PC0012", "Unit 1: Research Methods", "Distinction", "82", "Yes", "Yes"],
      ["Brown, Sarah", "PC0034", "Unit 1: Research Methods", "Merit", "71", "Yes", "No"],
      ["Clarke, Michael", "PC0051", "Unit 1: Research Methods", "Pass", "58", "No", "No"],
    ],
  },
  {
    id: "asmt-unconfirmed",
    name: "Unconfirmed Assessments",
    folder: "Assessments",
    description: "Assessments awaiting staff confirmation.",
    filters: [
      { key: "tutor", label: "Tutor", type: "text" },
      { key: "course", label: "Course", type: "select", options: ["All courses", "Level 3 BTEC", "GCSE English"] },
    ],
    columns: ["Assessment", "Course", "Due Date", "Learners Unconfirmed", "Tutor"],
    sampleRows: [
      ["Unit 3 Submission", "Level 3 BTEC", "15/01/2025", "7", "J. Smith"],
      ["Component 2 Marking", "GCSE English", "22/01/2025", "3", "A. Jones"],
    ],
  },
  {
    id: "ilp-progress",
    name: "ILP Progress Summary",
    folder: "ILP",
    description: "Overview of ILP completion status across learners.",
    filters: [
      { key: "academicYear", label: "Academic Year", type: "select", options: ["2024/25", "2023/24"] },
      { key: "tutor", label: "Tutor", type: "text" },
    ],
    columns: ["Learner", "Person Code", "Tutor", "ILP Status", "Last Review", "Next Review Due", "Targets Set"],
    sampleRows: [
      ["Adams, James", "PC0012", "J. Smith", "On track", "12/11/2024", "12/02/2025", "4"],
      ["Brown, Sarah", "PC0034", "A. Jones", "Needs review", "01/10/2024", "01/01/2025", "2"],
      ["Clarke, Michael", "PC0051", "J. Smith", "Complete", "15/12/2024", "15/03/2025", "6"],
    ],
  },
  {
    id: "ilp-reviews-due",
    name: "ILP Reviews Due",
    folder: "ILP",
    description: "Learners whose ILP review is due or overdue.",
    filters: [
      { key: "tutor", label: "Tutor", type: "text" },
      { key: "overdueTo", label: "Due before", type: "date" },
    ],
    columns: ["Learner", "Person Code", "Tutor", "Review Due Date", "Days Overdue"],
    sampleRows: [
      ["Brown, Sarah", "PC0034", "A. Jones", "01/01/2025", "25"],
      ["Evans, Liam", "PC0089", "B. Williams", "15/01/2025", "11"],
    ],
  },
  {
    id: "ilp-completion",
    name: "ILP Section Completion",
    folder: "ILP",
    description: "Completion rates for each ILP section.",
    filters: [
      { key: "academicYear", label: "Academic Year", type: "select", options: ["2024/25", "2023/24"] },
    ],
    columns: ["ILP Section", "Total Learners", "Completed", "Partial", "Not Started", "Completion %"],
    sampleRows: [
      ["Personal Details", "126", "126", "0", "0", "100%"],
      ["Learning Goals", "126", "114", "8", "4", "90.5%"],
      ["Support Needs", "126", "98", "18", "10", "77.8%"],
    ],
  },
  {
    id: "sg-at-risk",
    name: "At-Risk Learners",
    folder: "Safeguarding",
    description: "Learners flagged as at-risk based on attendance and progress.",
    filters: [
      { key: "threshold", label: "Attendance below", type: "select", options: ["80%", "75%", "70%"] },
      { key: "course", label: "Course", type: "select", options: ["All courses", "Level 3 BTEC", "GCSE English"] },
    ],
    columns: ["Learner", "Person Code", "Course", "Attendance %", "Flags", "Last Contacted"],
    sampleRows: [
      ["Evans, Liam", "PC0089", "GCSE English", "69.0%", "Attendance, Lateness", "15/01/2025"],
      ["Brown, Sarah", "PC0034", "Level 3 BTEC", "73.3%", "Attendance", "08/01/2025"],
    ],
  },
  {
    id: "sg-planned-absence",
    name: "Planned Absence Summary",
    folder: "Safeguarding",
    description: "Summary of planned absence requests and approval statuses.",
    filters: [
      { key: "dateFrom", label: "Date From", type: "date" },
      { key: "dateTo", label: "Date To", type: "date" },
      { key: "status", label: "Approval Status", type: "select", options: ["All", "Awaiting Decision", "Approved", "Declined"] },
    ],
    columns: ["Learner", "Person Code", "Reason", "From", "To", "Status"],
    sampleRows: [
      ["Adams, James", "PC0012", "University Visit", "20/01/2025", "20/01/2025", "Approved"],
      ["Brown, Sarah", "PC0034", "Holiday / Vacation", "14/02/2025", "21/02/2025", "Awaiting Decision"],
    ],
  },
  {
    id: "mb-verification-status",
    name: "Markbook Verification Status",
    folder: "Markbook",
    description: "Current verification status of markbook grades per unit.",
    filters: [
      { key: "course", label: "Course", type: "select", options: ["All courses", "Level 3 BTEC", "GCSE English"] },
      { key: "academicYear", label: "Academic Year", type: "select", options: ["2024/25", "2023/24"] },
    ],
    columns: ["Course", "Unit", "Total Learners", "Graded", "Verified", "Released", "% Verified"],
    sampleRows: [
      ["Level 3 BTEC", "Unit 1: Research Methods", "48", "45", "38", "30", "79.2%"],
      ["Level 3 BTEC", "Unit 2: Data Analysis", "48", "40", "22", "10", "45.8%"],
    ],
  },
  {
    id: "mb-grades-released",
    name: "Grades Released to Learners",
    folder: "Markbook",
    description: "Report of all grades that have been released to learners.",
    filters: [
      { key: "course", label: "Course", type: "select", options: ["All courses", "Level 3 BTEC"] },
      { key: "dateFrom", label: "Released From", type: "date" },
      { key: "dateTo", label: "Released To", type: "date" },
    ],
    columns: ["Learner", "Person Code", "Unit", "Grade", "Released On"],
    sampleRows: [
      ["Adams, James", "PC0012", "Unit 1: Research Methods", "Distinction", "15/01/2025"],
      ["Clarke, Michael", "PC0051", "Unit 1: Research Methods", "Pass", "15/01/2025"],
    ],
  },
];

const REPORT_MAP = Object.fromEntries(REPORTS.map((r) => [r.id, r]));

const RECENTLY_RUN = ["att-overall", "att-learner", "ilp-reviews-due", "sg-at-risk"];

// ─── Main component ────────────────────────────────────────────────────────────

export default function ManageReports() {
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set(["Attendance"]));
  const [activeReport, setActiveReport] = useState<ReportDef | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ReportDef[]>([]);
  const [searchDone, setSearchDone] = useState(false);
  const [view, setView] = useState<"recent" | "folders" | "search">("recent");

  // Report viewer state
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [reportRows, setReportRows] = useState<string[][] | null>(null);

  // Dialogs
  const [showPrint, setShowPrint] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [printDone, setPrintDone] = useState(false);

  const toggleFolder = (f: string) => {
    setOpenFolders((prev) => {
      const next = new Set(prev);
      next.has(f) ? next.delete(f) : next.add(f);
      return next;
    });
  };

  const openReport = (id: string) => {
    const r = REPORT_MAP[id];
    if (!r) return;
    setActiveReport(r);
    setFilterValues({});
    setReportRows(null);
    setEmailSent(false);
    setPrintDone(false);
    setEmailTo("");
    setEmailSubject(`Report: ${r.name}`);
    setEmailBody(`Please find attached the ${r.name} report.`);
  };

  const runReport = () => {
    if (!activeReport) return;
    setReportRows(activeReport.sampleRows);
  };

  const doSearch = () => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return;
    setSearchResults(REPORTS.filter((r) =>
      r.name.toLowerCase().includes(q) ||
      r.folder.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q)
    ));
    setSearchDone(true);
  };

  const sendEmail = () => {
    setEmailSent(true);
    setTimeout(() => setShowEmail(false), 1200);
  };

  const doPrint = () => {
    setPrintDone(true);
    setTimeout(() => setShowPrint(false), 1000);
  };

  return (
    <div className="-mx-6 -mt-6 min-h-screen bg-slate-50 flex flex-col">
      {/* Page header */}
      <div className="px-6 py-4 bg-white border-b border-gray-200 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <FileText size={18} className="text-teal-700" />
            <h1 className="text-xl font-bold text-gray-900">Manage Reports</h1>
            <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded font-medium">
              Role: Reports User
            </span>
          </div>
          <p className="text-sm text-gray-500">
            Find, filter, and run reports. Browse by folder, search by name, or re-open recently run reports.
          </p>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left panel */}
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
          {/* Recently run */}
          <button
            onClick={() => { setView("recent"); setActiveReport(null); }}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b border-gray-100 transition-colors ${view === "recent" && !activeReport ? "bg-teal-50 text-teal-700" : "text-gray-600 hover:bg-gray-50"}`}
          >
            <Clock size={14} /> Recently run
          </button>

          {/* Search */}
          <div className="px-3 py-2 border-b border-gray-100">
            <div className="flex gap-1">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { setView("search"); doSearch(); } }}
                placeholder="Search reports…"
                className="text-xs h-7"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2"
                onClick={() => { setView("search"); setActiveReport(null); doSearch(); }}
              >
                <Search size={12} />
              </Button>
            </div>
          </div>

          {/* Reports List / folder tree */}
          <div className="flex-1 overflow-y-auto py-1">
            <button
              onClick={() => { setView("folders"); setActiveReport(null); }}
              className={`w-full flex items-center gap-2 px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wide hover:bg-gray-50 transition-colors`}
            >
              <FileText size={11} /> Reports List
            </button>
            {FOLDER_STRUCTURE.map(({ name, reports }) => (
              <div key={name}>
                <button
                  onClick={() => toggleFolder(name)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {openFolders.has(name) ? <FolderOpen size={13} className="text-amber-500" /> : <Folder size={13} className="text-amber-400" />}
                  <span className="flex-1 text-left font-medium">{name}</span>
                  {openFolders.has(name) ? <ChevronUp size={11} className="text-gray-400" /> : <ChevronDown size={11} className="text-gray-400" />}
                </button>
                {openFolders.has(name) && reports.map((rid) => {
                  const r = REPORT_MAP[rid];
                  return r ? (
                    <button
                      key={rid}
                      onClick={() => { openReport(rid); setView("folders"); }}
                      className={`w-full flex items-center gap-2 pl-9 pr-4 py-1.5 text-xs transition-colors ${
                        activeReport?.id === rid ? "bg-teal-50 text-teal-700 font-semibold" : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <FileText size={11} className="shrink-0" />
                      <span className="text-left leading-tight">{r.name}</span>
                    </button>
                  ) : null;
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-auto">

          {/* Recently run view */}
          {view === "recent" && !activeReport && (
            <div className="p-6">
              <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <Clock size={14} /> Recently run reports
              </h2>
              <div className="grid grid-cols-2 gap-3 max-w-2xl">
                {RECENTLY_RUN.map((rid) => {
                  const r = REPORT_MAP[rid];
                  return r ? (
                    <button
                      key={rid}
                      onClick={() => openReport(rid)}
                      className="text-left border border-gray-200 rounded-lg px-4 py-3 bg-white hover:border-teal-400 hover:bg-teal-50/40 transition-colors group"
                    >
                      <div className="flex items-start gap-2">
                        <FileText size={14} className="text-teal-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-gray-800 group-hover:text-teal-700">{r.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{r.folder}</p>
                          <p className="text-xs text-gray-500 mt-1">{r.description}</p>
                        </div>
                      </div>
                    </button>
                  ) : null;
                })}
              </div>
            </div>
          )}

          {/* Search results view */}
          {view === "search" && !activeReport && (
            <div className="p-6">
              <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <Search size={14} /> Report Search
              </h2>
              <div className="flex gap-2 mb-5 max-w-md">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && doSearch()}
                  placeholder="Search by name, folder, or keyword…"
                  className="text-sm"
                />
                <Button className="bg-teal-700 hover:bg-teal-800 gap-1.5" onClick={doSearch}>
                  <Search size={13} /> Search
                </Button>
              </div>
              {searchDone && (
                searchResults.length === 0 ? (
                  <p className="text-sm text-gray-400">No reports found matching "{searchQuery}".</p>
                ) : (
                  <div className="space-y-2 max-w-2xl">
                    {searchResults.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => { openReport(r.id); }}
                        className="w-full text-left border border-gray-200 rounded-lg px-4 py-3 bg-white hover:border-teal-400 hover:bg-teal-50/40 transition-colors flex items-start gap-3"
                      >
                        <FileText size={14} className="text-teal-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{r.name}</p>
                          <p className="text-xs text-gray-400">{r.folder}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>
                        </div>
                        <ChevronRight size={14} className="text-gray-300 ml-auto mt-0.5 shrink-0" />
                      </button>
                    ))}
                    <p className="text-xs text-gray-400 pt-1">{searchResults.length} report{searchResults.length !== 1 ? "s" : ""} found</p>
                  </div>
                )
              )}
            </div>
          )}

          {/* Folder browse (no report open) */}
          {view === "folders" && !activeReport && (
            <div className="p-6">
              <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <Folder size={14} /> All Reports
              </h2>
              <div className="space-y-4 max-w-2xl">
                {FOLDER_STRUCTURE.map(({ name, reports }) => (
                  <div key={name} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                      <FolderOpen size={14} className="text-amber-500" />
                      <span className="text-sm font-bold text-gray-700">{name}</span>
                    </div>
                    {reports.map((rid) => {
                      const r = REPORT_MAP[rid];
                      return r ? (
                        <button
                          key={rid}
                          onClick={() => openReport(rid)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-teal-50/40 border-b border-gray-100 last:border-0 transition-colors"
                        >
                          <FileText size={13} className="text-gray-400 shrink-0" />
                          <span className="flex-1 text-left">{r.name}</span>
                          <span className="text-xs text-gray-400 hidden sm:block">{r.description}</span>
                          <ChevronRight size={13} className="text-gray-300 shrink-0" />
                        </button>
                      ) : null;
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Report viewer */}
          {activeReport && (
            <div className="flex flex-col min-h-0">
              {/* Report header */}
              <div className="px-6 py-3 bg-white border-b border-gray-200 flex items-center gap-3">
                <button
                  onClick={() => setActiveReport(null)}
                  className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                >
                  <X size={12} /> Close
                </button>
                <span className="text-gray-200">|</span>
                <span className="text-xs text-gray-400">{activeReport.folder}</span>
                <ChevronRight size={11} className="text-gray-300" />
                <span className="text-sm font-semibold text-gray-800">{activeReport.name}</span>
              </div>

              {/* Filter panel */}
              <div className="px-6 py-4 bg-white border-b border-gray-200">
                <div className="flex items-center gap-2 mb-3">
                  <Filter size={13} className="text-teal-700" />
                  <p className="text-xs font-semibold text-gray-700">Filter report</p>
                  {reportRows && (
                    <span className="text-[10px] text-amber-700 ml-2">
                      Filters changed — click View Report to update results.
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 items-end">
                  {activeReport.filters.map((f) => (
                    <div key={f.key} className="min-w-[140px]">
                      <label className="text-[10px] font-semibold text-gray-500 block mb-1">{f.label}</label>
                      {f.type === "select" ? (
                        <Select
                          value={filterValues[f.key] ?? (f.options?.[0] ?? "all")}
                          onValueChange={(v) => setFilterValues((prev) => ({ ...prev, [f.key]: v }))}
                        >
                          <SelectTrigger className="text-xs h-7 min-w-[140px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(f.options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : f.type === "date" ? (
                        <Input type="date" className="text-xs h-7 w-36" value={filterValues[f.key] ?? ""} onChange={(e) => setFilterValues((prev) => ({ ...prev, [f.key]: e.target.value }))} />
                      ) : (
                        <Input className="text-xs h-7 w-36" placeholder={f.label + "…"} value={filterValues[f.key] ?? ""} onChange={(e) => setFilterValues((prev) => ({ ...prev, [f.key]: e.target.value }))} />
                      )}
                    </div>
                  ))}
                  <Button className="bg-teal-700 hover:bg-teal-800 gap-1.5 h-7 text-xs" onClick={runReport}>
                    <Eye size={12} /> View Report
                  </Button>
                </div>
              </div>

              {/* Report actions + results */}
              {reportRows ? (
                <>
                  <div className="px-6 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                    <span className="text-xs text-gray-500">{reportRows.length} record{reportRows.length !== 1 ? "s" : ""}</span>
                    <div className="ml-auto flex gap-2">
                      <Button
                        variant="outline" size="sm" className="gap-1.5 text-xs h-7"
                        onClick={() => { setShowPrint(true); setPrintDone(false); }}
                      >
                        <Printer size={12} /> Print
                      </Button>
                      <Button
                        variant="outline" size="sm" className="gap-1.5 text-xs h-7"
                        onClick={() => { setShowEmail(true); setEmailSent(false); }}
                      >
                        <Mail size={12} /> Email Report
                      </Button>
                    </div>
                  </div>
                  <div className="overflow-auto px-0">
                    <table className="min-w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-100 border-b-2 border-gray-300">
                          {activeReport.columns.map((c) => (
                            <th key={c} className="px-4 py-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {reportRows.map((row, ri) => (
                          <tr key={ri} className={`${ri % 2 === 0 ? "bg-white" : "bg-slate-50/60"} border-b border-gray-100`}>
                            {row.map((cell, ci) => (
                              <td key={ci} className={`px-4 py-2 text-gray-700 ${
                                cell.endsWith("%") && parseFloat(cell) < 80 && activeReport.columns[ci]?.includes("%")
                                  ? "text-red-600 font-semibold"
                                  : ""
                              }`}>{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-sm text-gray-400 gap-2">
                  <Eye size={24} className="text-gray-300" />
                  Select filters above and click <strong className="text-gray-500">View Report</strong> to display results.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Print dialog */}
      <Dialog open={showPrint} onOpenChange={setShowPrint}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Printer size={16} /> Print Report</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Printer</label>
              <Select defaultValue="default">
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default Printer</SelectItem>
                  <SelectItem value="office">Office Printer (Main)</SelectItem>
                  <SelectItem value="pdf">Save as PDF</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Copies</label>
              <Input type="number" defaultValue="1" min="1" max="99" className="text-sm w-20" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPrint(false)}>Cancel</Button>
            <Button className="bg-teal-700 hover:bg-teal-800 gap-1.5" onClick={doPrint}>
              {printDone ? "Sent!" : <><Printer size={13} /> Print</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email dialog */}
      <Dialog open={showEmail} onOpenChange={setShowEmail}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Mail size={16} /> Email Report</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">To <span className="text-red-500">*</span></label>
              <Input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="recipient@college.ac.uk" className="text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Subject</label>
              <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} className="text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Message</label>
              <textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={3}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Format</label>
              <Select defaultValue="pdf">
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="excel">Excel (.xlsx)</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmail(false)}>Cancel</Button>
            <Button className="bg-teal-700 hover:bg-teal-800 gap-1.5" disabled={!emailTo || emailSent} onClick={sendEmail}>
              {emailSent ? "Sent ✓" : <><Mail size={13} /> Send</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
