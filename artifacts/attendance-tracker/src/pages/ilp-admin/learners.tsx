import { useState } from "react";
import { useLocation } from "wouter";
import { useListIlps, useListStudents } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { IlpAdminNav } from "./_nav";
import { Search, Users } from "lucide-react";
import { formatIlpDate, formatIlpStatus, getIlpTutorName, getSectionProgressLabel, latestIlpByStudent } from "@/lib/ilp";

const ILP_STATUSES = [
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "completed", label: "Completed" },
  { value: "none", label: "No ILP" },
];
const YEAR_GROUPS = ["Year 12", "Year 13", "Adult", "Access"];
const COURSES_FILTER = ["Level 3 BTEC", "GCSE Resit", "A Level", "Access to HE"];

const STATUS_STYLES: Record<string, string> = {
  active:    "bg-green-100 text-green-700 border-green-200",
  draft:     "bg-gray-100 text-gray-600 border-gray-200",
  completed: "bg-blue-100 text-blue-700 border-blue-200",
  none:      "bg-red-50 text-red-500 border-red-100",
};

export default function ManageLearnerIlps() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"name" | "cohort">("name");
  const [nameSearch, setNameSearch] = useState("");
  const [searched, setSearched] = useState(false);
  const [yearGroup, setYearGroup] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [ilpStatus, setIlpStatus] = useState("all");

  const { data: students = [], isLoading: studentsLoading } = useListStudents();
  const { data: ilps = [], isLoading: ilpsLoading, isError: ilpsError } = useListIlps();

  const ilpByStudent = latestIlpByStudent(ilps);
  const withStatus = students.map((s) => ({
    ...s,
    ilp: ilpByStudent.get(s.id),
    ilpStatus: ilpByStudent.get(s.id)?.status ?? "none",
  }));

  const nameFiltered = !searched ? [] : withStatus.filter((s) => {
    const full = `${s.forename} ${s.surname}`.toLowerCase();
    return full.includes(nameSearch.toLowerCase());
  });

  const cohortFiltered = withStatus.filter((s) => {
    const matchYG = yearGroup === "all" || s.yearGroup === yearGroup;
    const matchStatus = ilpStatus === "all" || s.ilpStatus === ilpStatus;
    return matchYG && matchStatus;
  });

  const displayList = activeTab === "name" ? nameFiltered : cohortFiltered;

  return (
    <div className="flex -mx-6 -mt-6 min-h-screen bg-slate-50">
      <IlpAdminNav active="Manage Learner ILPs" />
      <div className="flex-1 min-w-0 overflow-auto p-6">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-900">Manage Learner ILPs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Search for learners by name or use cohort filters to manage their ILPs.</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-4">
          {(["name", "cohort"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-teal-600 text-teal-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab === "name" ? "Search by name" : "Search by cohort filters"}
            </button>
          ))}
        </div>

        {activeTab === "name" && (
          <div className="flex gap-2 mb-4">
            <Input
              className="flex-1 h-8 text-sm"
              placeholder="Enter learner name…"
              value={nameSearch}
              onChange={(e) => { setNameSearch(e.target.value); setSearched(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") setSearched(true); }}
            />
            <Button
              className="h-8 bg-teal-700 hover:bg-teal-800 gap-1"
              onClick={() => setSearched(true)}
            >
              <Search size={13} /> Show learners
            </Button>
          </div>
        )}

        {activeTab === "cohort" && (
          <div className="flex gap-2 mb-4 flex-wrap">
            <Select value={yearGroup} onValueChange={setYearGroup}>
              <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Year group" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All year groups</SelectItem>
                {YEAR_GROUPS.map((yg) => <SelectItem key={yg} value={yg}>{yg}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger className="w-40 h-8 text-sm"><SelectValue placeholder="Course" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All courses</SelectItem>
                {COURSES_FILTER.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={ilpStatus} onValueChange={setIlpStatus}>
              <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="ILP status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ILP statuses</SelectItem>
                 {ILP_STATUSES.map((status) => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {studentsLoading || ilpsLoading ? (
            <div className="p-14 text-center text-sm text-gray-400">Loading learner ILPs…</div>
          ) : ilpsError ? (
            <div className="p-14 text-center text-sm text-red-600">Learner ILPs could not be loaded.</div>
          ) : (activeTab === "name" && !searched) ? (
            <div className="p-14 flex flex-col items-center text-gray-400">
              <Search className="w-10 h-10 mb-3 opacity-20" />
              <p className="text-sm">Enter a learner name and click <strong>Show learners</strong>.</p>
            </div>
          ) : displayList.length === 0 ? (
            <div className="p-14 flex flex-col items-center text-gray-400">
              <Users className="w-10 h-10 mb-3 opacity-20" />
              <p className="text-sm">No learners found.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Learner Name</th>
                  <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Person Code</th>
                   <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">ILP / Academic Year</th>
                  <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Tutor</th>
                   <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Review Dates</th>
                   <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Section Progress</th>
                  <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">ILP Status</th>
                  <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayList.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-blue-700">
                      <button className="hover:underline" onClick={() => navigate(`/students/${s.id}`)}>
                        {s.surname}, {s.forename}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{s.personCode}</td>
                     <td className="px-4 py-2.5 text-gray-500 text-xs">
                       <div>{s.ilp?.title ?? "No ILP"}</div>
                       <div className="text-[10px] text-gray-400">{s.ilp?.academicYear ?? s.yearGroup ?? "—"}</div>
                     </td>
                     <td className="px-4 py-2.5 text-gray-500 text-xs">{getIlpTutorName(s.ilp?.tutor)}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">
                       <div>Last {formatIlpDate(s.ilp?.lastReviewDate)}</div>
                       <div className="text-[10px] text-gray-400">Next {formatIlpDate(s.ilp?.nextReviewDue)}</div>
                    </td>
                     <td className="px-4 py-2.5 text-gray-500 text-xs">{s.ilp ? getSectionProgressLabel(s.ilp) : "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded border font-medium ${STATUS_STYLES[s.ilpStatus]}`}>
                         {s.ilp ? formatIlpStatus(s.ilp.status) : "No ILP"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        className="text-xs text-teal-700 hover:underline font-medium"
                        onClick={() => navigate(`/students/${s.id}`)}
                      >
                        View ILP
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
