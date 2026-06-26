import { useState } from "react";
import { useLocation } from "wouter";
import { useGetDashboardSummary, useGetTodaySchedule, useListTargets, useListCourses, useListStudents } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Calendar, BookOpen, AlertTriangle, ChevronRight, ChevronsUpDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

type CourseRow = {
  id: number;
  code: string;
  name: string;
  room?: string | null;
  staffName?: string | null;
  yearGroup?: string | null;
  enrolledCount: number;
};

function CourseSearchResults({ results }: { results: CourseRow[] }) {
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState("");

  const filtered = filter
    ? results.filter(c =>
        (c.code + " " + c.name).toLowerCase().includes(filter.toLowerCase())
      )
    : results;

  return (
    <div className="border border-slate-300 rounded overflow-hidden text-sm">
      <div className="bg-slate-700 text-white px-4 py-2 font-semibold text-sm">
        Course / Group Search Results
      </div>
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200">
        <span className="text-xs text-slate-500">
          Showing {filtered.length} of {results.length} {results.length === 1 ? "entry" : "entries"} (max 100)
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Filter:</span>
          <Input value={filter} onChange={e => setFilter(e.target.value)} className="h-6 w-32 text-xs px-2 py-0" />
        </div>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {["Course Code", "Course Description", "Calendar Occurrence", "Start Date", "End Date", "Staff"].map(col => (
              <th key={col} className="text-left text-xs font-semibold text-slate-600 px-3 py-2">
                <span className="flex items-center gap-1 cursor-pointer select-none hover:text-slate-900">
                  {col} <ChevronsUpDown className="w-3 h-3 opacity-50" />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-slate-400">No courses found.</td>
            </tr>
          ) : (
            filtered.map(c => (
              <tr key={c.id} className="hover:bg-blue-50 cursor-pointer" onClick={() => navigate(`/courses/${c.id}`)}>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-1.5">
                    <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="text-sky-700 font-medium hover:underline">{c.code}</span>
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-700">{c.name}</td>
                <td className="px-3 py-2 text-slate-500">Current Year</td>
                <td className="px-3 py-2 text-slate-500">—</td>
                <td className="px-3 py-2 text-slate-500">—</td>
                <td className="px-3 py-2 text-slate-500">{c.staffName ?? "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-t border-slate-200">
        <span className="text-xs text-slate-500">Showing 1 to {filtered.length} of {filtered.length} entries (max 100)</span>
        <div className="flex gap-1">
          <button className="w-7 h-7 rounded border border-slate-300 bg-white text-slate-500 text-xs flex items-center justify-center hover:bg-slate-100 disabled:opacity-40" disabled>‹</button>
          <button className="w-7 h-7 rounded border border-slate-300 bg-white text-slate-500 text-xs flex items-center justify-center hover:bg-slate-100 disabled:opacity-40" disabled>›</button>
        </div>
      </div>
    </div>
  );
}

type StudentRow = {
  id: number;
  forename: string;
  surname: string;
  dateOfBirth?: string | null;
  gender?: string | null;
  postCode?: string | null;
  atRisk: boolean;
};

function LearnerSearchResults({ results }: { results: StudentRow[] }) {
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState("");

  const filtered = filter
    ? results.filter(s =>
        `${s.surname} ${s.forename}`.toLowerCase().includes(filter.toLowerCase())
      )
    : results;

  return (
    <div className="border border-slate-300 rounded overflow-hidden text-sm">
      {/* Dark header */}
      <div className="bg-slate-700 text-white px-4 py-2 font-semibold text-sm">
        Learner Search Results
      </div>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200">
        <span className="text-xs text-slate-500">
          Showing {filtered.length} of {results.length} {results.length === 1 ? "entry" : "entries"} (max 100)
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Filter:</span>
          <Input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="h-6 w-32 text-xs px-2 py-0"
            placeholder=""
          />
        </div>
      </div>
      {/* Table */}
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {["Learner", "Date of Birth", "Gender", "Address"].map(col => (
              <th key={col} className="text-left text-xs font-semibold text-slate-600 px-3 py-2">
                <span className="flex items-center gap-1 cursor-pointer select-none hover:text-slate-900">
                  {col} <ChevronsUpDown className="w-3 h-3 opacity-50" />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-3 py-6 text-center text-slate-400 text-sm">
                No learners found.
              </td>
            </tr>
          ) : (
            filtered.map(s => (
              <tr
                key={s.id}
                className="hover:bg-blue-50 cursor-pointer"
                onClick={() => navigate(`/students/${s.id}`)}
              >
                <td className="px-3 py-2">
                  <span className="flex items-center gap-1.5">
                    <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="text-sky-700 font-medium hover:underline">
                      {s.surname}, {s.forename}
                    </span>
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-700">{s.dateOfBirth ?? ""}</td>
                <td className="px-3 py-2 text-slate-700">{s.gender ?? ""}</td>
                <td className="px-3 py-2 text-slate-700">{s.postCode ?? ""}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {/* Footer pagination */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-t border-slate-200">
        <span className="text-xs text-slate-500">
          Showing 1 to {filtered.length} of {filtered.length} entries (max 100)
        </span>
        <div className="flex gap-1">
          <button className="w-7 h-7 rounded border border-slate-300 bg-white text-slate-500 text-xs flex items-center justify-center hover:bg-slate-100 disabled:opacity-40" disabled>‹</button>
          <button className="w-7 h-7 rounded border border-slate-300 bg-white text-slate-500 text-xs flex items-center justify-center hover:bg-slate-100 disabled:opacity-40" disabled>›</button>
        </div>
      </div>
    </div>
  );
}

function CourseSearchTab() {
  const { data: allCourses } = useListCourses();
  const [courseCode, setCourseCode] = useState("");
  const [description, setDescription] = useState("");
  const [startDateOp, setStartDateOp] = useState("=");
  const [startDate, setStartDate] = useState("");
  const [startTimeOp, setStartTimeOp] = useState("=");
  const [startTime, setStartTime] = useState("");
  const [occurrenceCode, setOccurrenceCode] = useState("");
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<typeof allCourses>([]);

  function handleSearch() {
    const filtered = (allCourses ?? []).filter(c => {
      if (courseCode && !c.code.toLowerCase().includes(courseCode.toLowerCase())) return false;
      if (description && !c.name.toLowerCase().includes(description.toLowerCase())) return false;
      return true;
    });
    setResults(filtered);
    setSearched(true);
  }

  return (
    <TabsContent value="course" className="mt-0 outline-none">
      <div className="space-y-0">
        <div className="grid grid-cols-2 gap-x-8">
          {/* LEFT */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-28 shrink-0 text-sm text-slate-700">Course Code</span>
              <Input value={courseCode} onChange={e => { setCourseCode(e.target.value); setSearched(false); }} className="flex-1 h-8 text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-28 shrink-0 text-sm text-slate-700">Description</span>
              <Input value={description} onChange={e => { setDescription(e.target.value); setSearched(false); }} className="flex-1 h-8 text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-28 shrink-0 text-sm text-slate-700">Start Date</span>
              <div className="flex flex-1 gap-1">
                <Select value={startDateOp} onValueChange={setStartDateOp}>
                  <SelectTrigger className="w-14 shrink-0 text-xs px-1.5 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="=">=</SelectItem>
                    <SelectItem value="before">{"<"}</SelectItem>
                    <SelectItem value="after">{">"}</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="flex-1 h-8 text-sm" />
              </div>
            </div>
          </div>
          {/* RIGHT */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-36 shrink-0 text-sm text-slate-700">Occurrence Code</span>
              <Select value={occurrenceCode} onValueChange={setOccurrenceCode}>
                <SelectTrigger className="flex-1 h-8 text-sm"><SelectValue placeholder="" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Current Year</SelectItem>
                  <SelectItem value="2024">2024/2025</SelectItem>
                  <SelectItem value="2023">2023/2024</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-36 shrink-0 text-sm text-slate-700">Start Time</span>
              <div className="flex flex-1 gap-1">
                <Select value={startTimeOp} onValueChange={setStartTimeOp}>
                  <SelectTrigger className="w-14 shrink-0 text-xs px-1.5 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="=">=</SelectItem>
                    <SelectItem value="before">{"<"}</SelectItem>
                    <SelectItem value="after">{">"}</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="flex-1 h-8 text-sm" placeholder="--:--" />
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end pt-3">
          <Button onClick={handleSearch} className="gap-2 bg-sky-600 hover:bg-sky-700 text-white px-6 h-8 text-sm">
            <Search className="w-3.5 h-3.5" /> Search
          </Button>
        </div>
        {searched && (
          <div className="mt-4">
            <CourseSearchResults results={results ?? []} />
          </div>
        )}
      </div>
    </TabsContent>
  );
}

const START_TIMES_REG = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00"];

type RegisterRow = {
  id: number;
  code: string;
  name: string;
  room?: string | null;
  staffName?: string | null;
  yearGroup?: string | null;
  enrolledCount: number;
};

function RegisterSearchResults({ results }: { results: RegisterRow[] }) {
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState("");

  const filtered = filter
    ? results.filter(r => (r.name + " " + r.code).toLowerCase().includes(filter.toLowerCase()))
    : results;

  return (
    <div className="border border-slate-300 rounded overflow-hidden text-sm">
      <div className="bg-slate-700 text-white px-4 py-2 font-semibold text-sm">
        Register Search Results
      </div>
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200">
        <span className="text-xs text-slate-500">
          Showing {filtered.length} of {results.length} {results.length === 1 ? "entry" : "entries"} (max 100)
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Filter:</span>
          <Input value={filter} onChange={e => setFilter(e.target.value)} className="h-6 w-32 text-xs px-2 py-0" />
        </div>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {["Description", "Event Id", "Session", "Start Date", "End Date", "Event Start Time", "Event End Time"].map(col => (
              <th key={col} className="text-left text-xs font-semibold text-slate-600 px-3 py-2">
                <span className="flex items-center gap-1 cursor-pointer select-none hover:text-slate-900">
                  {col} <ChevronsUpDown className="w-3 h-3 opacity-50" />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-3 py-6 text-center text-slate-400">No registers found.</td>
            </tr>
          ) : (
            filtered.map(r => {
              const startTime = START_TIMES_REG[r.id % START_TIMES_REG.length];
              const [h, m] = startTime.split(":").map(Number);
              const endTime = `${String(h + 1).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
              return (
                <tr key={r.id} className="hover:bg-blue-50 cursor-pointer" onClick={() => navigate(`/registers/${r.id}`)}>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1.5">
                      <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="text-sky-700 font-medium hover:underline">{r.name} (CLASS)</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{1000 + r.id}</td>
                  <td className="px-3 py-2 text-slate-600">Current</td>
                  <td className="px-3 py-2 text-slate-500">01/08/2024</td>
                  <td className="px-3 py-2 text-slate-500">31/07/2025</td>
                  <td className="px-3 py-2 text-slate-600">{startTime}</td>
                  <td className="px-3 py-2 text-slate-600">{endTime}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-t border-slate-200">
        <span className="text-xs text-slate-500">Showing 1 to {filtered.length} of {filtered.length} entries (max 100)</span>
        <div className="flex gap-1">
          <button className="w-7 h-7 rounded border border-slate-300 bg-white text-slate-500 text-xs flex items-center justify-center hover:bg-slate-100 disabled:opacity-40" disabled>‹</button>
          <button className="w-7 h-7 rounded border border-slate-300 bg-white text-slate-500 text-xs flex items-center justify-center hover:bg-slate-100 disabled:opacity-40" disabled>›</button>
        </div>
      </div>
    </div>
  );
}

function RegisterSearchTab() {
  const { data: allCourses } = useListCourses();
  const [registerKey, setRegisterKey] = useState("");
  const [registerKeyOp, setRegisterKeyOp] = useState("=");
  const [description, setDescription] = useState("");
  const [staffSurname, setStaffSurname] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [startTimeOp, setStartTimeOp] = useState("=");
  const [startTime, setStartTime] = useState("");
  const [endTimeOp, setEndTimeOp] = useState("=");
  const [endTime, setEndTime] = useState("");
  const [session, setSession] = useState("");
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<typeof allCourses>([]);

  function handleSearch() {
    const filtered = (allCourses ?? []).filter(c => {
      if (description && !c.name.toLowerCase().includes(description.toLowerCase())) return false;
      if (staffSurname && !(c.staffName ?? "").toLowerCase().includes(staffSurname.toLowerCase())) return false;
      if (roomCode && !(c.room ?? "").toLowerCase().includes(roomCode.toLowerCase())) return false;
      return true;
    });
    setResults(filtered);
    setSearched(true);
  }

  const opOptions = (
    <>
      <SelectItem value="=">=</SelectItem>
      <SelectItem value="<">{"<"}</SelectItem>
      <SelectItem value=">">{">"}</SelectItem>
    </>
  );

  return (
    <TabsContent value="register" className="mt-0 outline-none">
      <div className="space-y-0">
        <div className="grid grid-cols-2 gap-x-8">
          {/* LEFT */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-32 shrink-0 text-sm text-slate-700">Register Key</span>
              <div className="flex flex-1 gap-1">
                <Select value={registerKeyOp} onValueChange={setRegisterKeyOp}>
                  <SelectTrigger className="w-14 shrink-0 text-xs px-1.5 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{opOptions}</SelectContent>
                </Select>
                <Input value={registerKey} onChange={e => { setRegisterKey(e.target.value); setSearched(false); }} className="flex-1 h-8 text-sm" type="number" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-32 shrink-0 text-sm text-slate-700">Staff Surname</span>
              <Input value={staffSurname} onChange={e => { setStaffSurname(e.target.value); setSearched(false); }} className="flex-1 h-8 text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-32 shrink-0 text-sm text-slate-700">Start Time</span>
              <div className="flex flex-1 gap-1">
                <Select value={startTimeOp} onValueChange={setStartTimeOp}>
                  <SelectTrigger className="w-14 shrink-0 text-xs px-1.5 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{opOptions}</SelectContent>
                </Select>
                <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="flex-1 h-8 text-sm" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-32 shrink-0 text-sm text-slate-700">Session</span>
              <Select value={session} onValueChange={v => { setSession(v === "_all" ? "" : v); setSearched(false); }}>
                <SelectTrigger className="flex-1 h-8 text-sm"><SelectValue placeholder="" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">— All —</SelectItem>
                  <SelectItem value="AM">AM</SelectItem>
                  <SelectItem value="PM">PM</SelectItem>
                  <SelectItem value="Evening">Evening</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* RIGHT */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-32 shrink-0 text-sm text-slate-700">Description</span>
              <Input value={description} onChange={e => { setDescription(e.target.value); setSearched(false); }} className="flex-1 h-8 text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-32 shrink-0 text-sm text-slate-700">Room Code</span>
              <Input value={roomCode} onChange={e => { setRoomCode(e.target.value); setSearched(false); }} className="flex-1 h-8 text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-32 shrink-0 text-sm text-slate-700">End Time</span>
              <div className="flex flex-1 gap-1">
                <Select value={endTimeOp} onValueChange={setEndTimeOp}>
                  <SelectTrigger className="w-14 shrink-0 text-xs px-1.5 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{opOptions}</SelectContent>
                </Select>
                <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="flex-1 h-8 text-sm" />
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end pt-3">
          <Button onClick={handleSearch} className="gap-2 bg-sky-600 hover:bg-sky-700 text-white px-6 h-8 text-sm">
            <Search className="w-3.5 h-3.5" /> Search
          </Button>
        </div>
        {searched && (
          <div className="mt-4">
            <RegisterSearchResults results={results ?? []} />
          </div>
        )}
      </div>
    </TabsContent>
  );
}

const EXAM_NAMES_LIST = [
  "Functional Skills English Level 1 - Reading",
  "Functional Skills English Level 1 - Writing",
  "Functional Skills English Level 2 - Reading",
  "Functional Skills Maths Level 1",
  "Functional Skills Maths Level 2",
  "BTEC Business Unit Assessment",
  "A Level Business Studies Paper 1",
  "A Level Mathematics Paper 2",
];
const EXAM_START_TIMES = ["09:00", "10:00", "13:00", "13:30", "14:00"];
const EXAM_FINISH_TIMES = ["10:00", "11:00", "14:00", "14:30", "15:00"];
const EXAM_DATES_LIST = ["23/01/2025", "24/01/2025", "24/01/2025", "25/01/2025"];
const BOARD_OCC_LIST = ["23JAN17AM", "24JAN17PM", "24JAN17AM", "25JAN17PM"];

type ExamRow = {
  id: number;
  code: string;
  name: string;
  staffName?: string | null;
  enrolledCount: number;
};

function ExamSearchResults({ results }: { results: ExamRow[] }) {
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState("");

  const filtered = filter
    ? results.filter(r => (r.name + " " + r.code).toLowerCase().includes(filter.toLowerCase()))
    : results;

  return (
    <div className="border border-slate-300 rounded overflow-hidden text-sm">
      <div className="bg-slate-700 text-white px-4 py-2 font-semibold text-sm">
        Exam Search Results
      </div>
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200">
        <span className="text-xs text-slate-500">
          Showing {filtered.length} of {results.length} {results.length === 1 ? "entry" : "entries"} (max 100)
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Filter:</span>
          <Input value={filter} onChange={e => setFilter(e.target.value)} className="h-6 w-32 text-xs px-2 py-0" />
        </div>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {["Board Code", "Exam Code", "Exam Name", "Board Occurrence", "Exam Date", "Start Time", "Finish Time", "Entries"].map(col => (
              <th key={col} className="text-left text-xs font-semibold text-slate-600 px-3 py-2">
                <span className="flex items-center gap-1 cursor-pointer select-none hover:text-slate-900">
                  {col} <ChevronsUpDown className="w-3 h-3 opacity-50" />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-3 py-6 text-center text-slate-400">No exams found.</td>
            </tr>
          ) : (
            filtered.map(r => {
              const idx = r.id % EXAM_START_TIMES.length;
              const examName = EXAM_NAMES_LIST[(r.id - 1) % EXAM_NAMES_LIST.length];
              const examCode = `${r.id * 374801}-${String(r.id).padStart(3, "0")}`;
              return (
                <tr key={r.id} className="hover:bg-blue-50 cursor-pointer" onClick={() => navigate(`/exams/${r.id}`)}>
                  <td className="px-3 py-2 text-slate-600">CG</td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1.5">
                      <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="text-sky-700 font-medium hover:underline">{examCode}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-700">{examName}</td>
                  <td className="px-3 py-2 text-slate-600">{BOARD_OCC_LIST[r.id % BOARD_OCC_LIST.length]}</td>
                  <td className="px-3 py-2 text-slate-500">{EXAM_DATES_LIST[r.id % EXAM_DATES_LIST.length]}</td>
                  <td className="px-3 py-2 text-slate-600">{EXAM_START_TIMES[idx]}</td>
                  <td className="px-3 py-2 text-slate-600">{EXAM_FINISH_TIMES[idx]}</td>
                  <td className="px-3 py-2 text-slate-600">{r.enrolledCount}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-t border-slate-200">
        <span className="text-xs text-slate-500">Showing 1 to {filtered.length} of {filtered.length} entries (max 100)</span>
        <div className="flex gap-1">
          <button className="w-7 h-7 rounded border border-slate-300 bg-white text-slate-500 text-xs flex items-center justify-center hover:bg-slate-100 disabled:opacity-40" disabled>‹</button>
          <button className="w-7 h-7 rounded border border-slate-300 bg-white text-slate-500 text-xs flex items-center justify-center hover:bg-slate-100 disabled:opacity-40" disabled>›</button>
        </div>
      </div>
    </div>
  );
}

function ExamSearchTab() {
  const { data: allCourses } = useListCourses();
  const [examCode, setExamCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [level, setLevel] = useState("");
  const [method, setMethod] = useState("");
  const [dateOp, setDateOp] = useState("=");
  const [date, setDate] = useState("");
  const [startTimeOp, setStartTimeOp] = useState("=");
  const [startTime, setStartTime] = useState("");
  const [endTimeOp, setEndTimeOp] = useState("=");
  const [endTime, setEndTime] = useState("");
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<typeof allCourses>([]);

  function handleSearch() {
    const filtered = (allCourses ?? []).filter(c => {
      if (name && !c.name.toLowerCase().includes(name.toLowerCase())) return false;
      return true;
    });
    setResults(filtered);
    setSearched(true);
  }

  const opOptions = (
    <>
      <SelectItem value="=">=</SelectItem>
      <SelectItem value="<">{"<"}</SelectItem>
      <SelectItem value=">">{">"}</SelectItem>
    </>
  );

  return (
    <TabsContent value="exam" className="mt-0 outline-none">
      <div className="space-y-0">
        <div className="grid grid-cols-2 gap-x-8">
          {/* LEFT */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-28 shrink-0 text-sm text-slate-700">Exam Code</span>
              <Input value={examCode} onChange={e => { setExamCode(e.target.value); setSearched(false); }} className="flex-1 h-8 text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-28 shrink-0 text-sm text-slate-700">Name</span>
              <Input value={name} onChange={e => { setName(e.target.value); setSearched(false); }} className="flex-1 h-8 text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-28 shrink-0 text-sm text-slate-700">Method</span>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="flex-1 h-8 text-sm"><SelectValue placeholder="" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="written">Written</SelectItem>
                  <SelectItem value="oral">Oral</SelectItem>
                  <SelectItem value="coursework">Coursework</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-28 shrink-0 text-sm text-slate-700">Start Time</span>
              <div className="flex flex-1 gap-1">
                <Select value={startTimeOp} onValueChange={setStartTimeOp}>
                  <SelectTrigger className="w-14 shrink-0 text-xs px-1.5 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{opOptions}</SelectContent>
                </Select>
                <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="flex-1 h-8 text-sm" placeholder="--:--" />
              </div>
            </div>
          </div>
          {/* RIGHT */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-sm text-slate-700">Type</span>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="flex-1 h-8 text-sm"><SelectValue placeholder="" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="written">Written</SelectItem>
                  <SelectItem value="practical">Practical</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-sm text-slate-700">Level</span>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger className="flex-1 h-8 text-sm"><SelectValue placeholder="" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="l1">Level 1</SelectItem>
                  <SelectItem value="l2">Level 2</SelectItem>
                  <SelectItem value="l3">Level 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-sm text-slate-700">Date</span>
              <div className="flex flex-1 gap-1">
                <Select value={dateOp} onValueChange={setDateOp}>
                  <SelectTrigger className="w-14 shrink-0 text-xs px-1.5 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{opOptions}</SelectContent>
                </Select>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="flex-1 h-8 text-sm" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-sm text-slate-700">End Time</span>
              <div className="flex flex-1 gap-1">
                <Select value={endTimeOp} onValueChange={setEndTimeOp}>
                  <SelectTrigger className="w-14 shrink-0 text-xs px-1.5 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{opOptions}</SelectContent>
                </Select>
                <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="flex-1 h-8 text-sm" placeholder="--:--" />
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end pt-3">
          <Button onClick={handleSearch} className="gap-2 bg-sky-600 hover:bg-sky-700 text-white px-6 h-8 text-sm">
            <Search className="w-3.5 h-3.5" /> Search
          </Button>
        </div>
        {searched && (
          <div className="mt-4">
            <ExamSearchResults results={results ?? []} />
          </div>
        )}
      </div>
    </TabsContent>
  );
}

const ROOM_TYPES = ["Classroom", "Laboratory", "Sports Hall", "IT Suite", "Music Room", "Art Room", "Library", "Conference Room"];
const SITES = ["Main Campus", "North Block", "South Annexe", "Sports Centre"];

type RoomRow = { id: number; code: string; description: string; roomType: string; site: string };
type StaffRow = { id: number; code: string; forename: string; surname: string; organisation: string; position: string };

const POSITIONS = ["Teacher", "Head of Department", "Senior Teacher", "Assistant Principal", "Subject Leader", "Form Tutor"];
const DEPARTMENTS = ["Business & Administration", "Mathematics", "English", "Science", "Arts", "Computing", "PE", "MFL"];

function RoomSearchResults({ results }: { results: RoomRow[] }) {
  const [, navigate] = useLocation();
  if (results.length === 0) {
    return <div className="text-sm text-slate-400 py-3">No rooms found matching the search criteria.</div>;
  }
  return (
    <div className="border border-slate-200 rounded overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-100 border-b border-slate-200">
            <th className="text-left text-xs font-semibold text-slate-600 px-3 py-2">Room Code</th>
            <th className="text-left text-xs font-semibold text-slate-600 px-3 py-2">Description</th>
            <th className="text-left text-xs font-semibold text-slate-600 px-3 py-2">Room Type</th>
            <th className="text-left text-xs font-semibold text-slate-600 px-3 py-2">Site</th>
            <th className="text-left text-xs font-semibold text-slate-600 px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {results.map(r => (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className="px-3 py-2">
                <button onClick={() => navigate(`/rooms/${r.id}`)} className="text-sky-700 hover:underline font-medium text-xs">
                  {r.code}
                </button>
              </td>
              <td className="px-3 py-2 text-slate-700">{r.description}</td>
              <td className="px-3 py-2 text-slate-600">{r.roomType}</td>
              <td className="px-3 py-2 text-slate-600">{r.site}</td>
              <td className="px-3 py-2">
                <button onClick={() => navigate(`/rooms/${r.id}`)} className="text-sky-700 hover:underline text-xs">Book</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
        {results.length} room{results.length !== 1 ? "s" : ""} found
      </div>
    </div>
  );
}

function RoomSearchTab() {
  const { data: courses } = useListCourses();
  const [roomCode, setRoomCode] = useState("");
  const [roomDesc, setRoomDesc] = useState("");
  const [sessionCode, setSessionCode] = useState("");
  const [roomType, setRoomType] = useState("");
  const [site, setSite] = useState("");
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<RoomRow[]>([]);

  const allRooms: RoomRow[] = [...new Set((courses ?? []).map(c => c.room).filter(Boolean))]
    .map((name, idx) => ({
      id: idx,
      code: name as string,
      description: `${ROOM_TYPES[idx % ROOM_TYPES.length]} — ${name}`,
      roomType: ROOM_TYPES[idx % ROOM_TYPES.length],
      site: SITES[idx % SITES.length],
    }));

  function handleSearch() {
    const filtered = allRooms.filter(r => {
      if (roomCode && !r.code.toLowerCase().includes(roomCode.toLowerCase())) return false;
      if (roomDesc && !r.description.toLowerCase().includes(roomDesc.toLowerCase())) return false;
      if (roomType && r.roomType !== roomType) return false;
      if (site && r.site !== site) return false;
      return true;
    });
    setResults(filtered);
    setSearched(true);
  }

  return (
    <TabsContent value="room" className="mt-0 outline-none">
      <div className="space-y-0">
        <div className="grid grid-cols-2 gap-x-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-32 shrink-0 text-sm text-slate-700">Room Code</span>
              <Input value={roomCode} onChange={e => { setRoomCode(e.target.value); setSearched(false); }} className="flex-1 h-8 text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-32 shrink-0 text-sm text-slate-700">Room Description</span>
              <Input value={roomDesc} onChange={e => { setRoomDesc(e.target.value); setSearched(false); }} className="flex-1 h-8 text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-32 shrink-0 text-sm text-slate-700">Session Code</span>
              <Input value={sessionCode} onChange={e => { setSessionCode(e.target.value); setSearched(false); }} className="flex-1 h-8 text-sm" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-sm text-slate-700">Room Type</span>
              <Select value={roomType} onValueChange={v => { setRoomType(v === "_all" ? "" : v); setSearched(false); }}>
                <SelectTrigger className="flex-1 h-8 text-sm"><SelectValue placeholder="" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">— All —</SelectItem>
                  {ROOM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-sm text-slate-700">Site</span>
              <Select value={site} onValueChange={v => { setSite(v === "_all" ? "" : v); setSearched(false); }}>
                <SelectTrigger className="flex-1 h-8 text-sm"><SelectValue placeholder="" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">— All —</SelectItem>
                  {SITES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="flex justify-end pt-3">
          <Button onClick={handleSearch} className="gap-2 bg-sky-600 hover:bg-sky-700 text-white px-6 h-8 text-sm">
            <Search className="w-3.5 h-3.5" /> Search
          </Button>
        </div>
        {searched && (
          <div className="mt-4">
            <RoomSearchResults results={results} />
          </div>
        )}
      </div>
    </TabsContent>
  );
}

function StaffSearchResults({ results }: { results: StaffRow[] }) {
  const [, navigate] = useLocation();
  if (results.length === 0) {
    return <div className="text-sm text-slate-400 py-3">No staff found matching the search criteria.</div>;
  }
  return (
    <div className="border border-slate-200 rounded overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-100 border-b border-slate-200">
            <th className="text-left text-xs font-semibold text-slate-600 px-3 py-2">Staff Code</th>
            <th className="text-left text-xs font-semibold text-slate-600 px-3 py-2">Forename</th>
            <th className="text-left text-xs font-semibold text-slate-600 px-3 py-2">Surname</th>
            <th className="text-left text-xs font-semibold text-slate-600 px-3 py-2">Organisation</th>
            <th className="text-left text-xs font-semibold text-slate-600 px-3 py-2">Position</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {results.map(r => (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className="px-3 py-2">
                <button onClick={() => navigate(`/staff/${r.id}`)} className="text-sky-700 hover:underline font-medium text-xs">
                  {r.code}
                </button>
              </td>
              <td className="px-3 py-2 text-slate-700">{r.forename}</td>
              <td className="px-3 py-2 text-slate-700">
                <button onClick={() => navigate(`/staff/${r.id}`)} className="text-sky-700 hover:underline">
                  {r.surname}
                </button>
              </td>
              <td className="px-3 py-2 text-slate-600">{r.organisation}</td>
              <td className="px-3 py-2 text-slate-600">{r.position}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
        {results.length} staff member{results.length !== 1 ? "s" : ""} found
      </div>
    </div>
  );
}

function StaffSearchTab() {
  const { data: courses } = useListCourses();
  const [staffCode, setStaffCode] = useState("");
  const [forename, setForename] = useState("");
  const [surname, setSurname] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [position, setPosition] = useState("");
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<StaffRow[]>([]);

  const allStaff: StaffRow[] = [...new Set((courses ?? []).map(c => c.staffName).filter(Boolean) as string[])]
    .map((name, idx) => {
      const parts = name.split(" ");
      const fn = parts.slice(0, -1).join(" ") || name;
      const sn = parts.length > 1 ? parts[parts.length - 1] : "";
      return {
        id: idx,
        code: `S${String(idx).padStart(4, "0")}`,
        forename: fn,
        surname: sn,
        organisation: DEPARTMENTS[idx % DEPARTMENTS.length],
        position: POSITIONS[idx % POSITIONS.length],
      };
    });

  function handleSearch() {
    const filtered = allStaff.filter(s => {
      if (staffCode && !s.code.toLowerCase().includes(staffCode.toLowerCase())) return false;
      if (forename && !s.forename.toLowerCase().includes(forename.toLowerCase())) return false;
      if (surname && !s.surname.toLowerCase().includes(surname.toLowerCase())) return false;
      if (organisation && !s.organisation.toLowerCase().includes(organisation.toLowerCase())) return false;
      if (position && !s.position.toLowerCase().includes(position.toLowerCase())) return false;
      return true;
    });
    setResults(filtered);
    setSearched(true);
  }

  return (
    <TabsContent value="staff" className="mt-0 outline-none">
      <div className="space-y-0">
        <div className="grid grid-cols-2 gap-x-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-28 shrink-0 text-sm text-slate-700">Staff Code</span>
              <Input value={staffCode} onChange={e => { setStaffCode(e.target.value); setSearched(false); }} className="flex-1 h-8 text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-28 shrink-0 text-sm text-slate-700">Forename</span>
              <Input value={forename} onChange={e => { setForename(e.target.value); setSearched(false); }} className="flex-1 h-8 text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-28 shrink-0 text-sm text-slate-700">Surname</span>
              <Input value={surname} onChange={e => { setSurname(e.target.value); setSearched(false); }} className="flex-1 h-8 text-sm" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-28 shrink-0 text-sm text-slate-700">Organisation</span>
              <Input value={organisation} onChange={e => { setOrganisation(e.target.value); setSearched(false); }} className="flex-1 h-8 text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-28 shrink-0 text-sm text-slate-700">Position</span>
              <Input value={position} onChange={e => { setPosition(e.target.value); setSearched(false); }} className="flex-1 h-8 text-sm" />
            </div>
          </div>
        </div>
        <div className="flex justify-end pt-3">
          <Button onClick={handleSearch} className="gap-2 bg-sky-600 hover:bg-sky-700 text-white px-6 h-8 text-sm">
            <Search className="w-3.5 h-3.5" /> Search
          </Button>
        </div>
        {searched && (
          <div className="mt-4">
            <StaffSearchResults results={results} />
          </div>
        )}
      </div>
    </TabsContent>
  );
}

function StatsCard({ title, value, unit = "", colorClass = "bg-white text-slate-800 border-slate-200" }: { title: string, value?: string | number, unit?: string, colorClass?: string }) {
  return (
    <Card className={`rounded-xl shadow-sm overflow-hidden border ${colorClass}`}>
      <CardContent className="p-4 flex flex-col items-center justify-center text-center h-24">
        <p className="text-xs font-semibold uppercase tracking-wider opacity-80 mb-1">{title}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold">{value !== undefined ? value : <Skeleton className="h-8 w-16" />}</span>
          {unit && <span className="text-sm font-medium opacity-80">{unit}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const { data: summary } = useGetDashboardSummary();
  const { data: schedule, isLoading: isScheduleLoading } = useGetTodaySchedule();
  const { data: targets, isLoading: isTargetsLoading } = useListTargets({ overdue: true });
  const { data: courses, isLoading: isCoursesLoading } = useListCourses();

  const [personCode, setPersonCode] = useState("");
  const [personCodeOp, setPersonCodeOp] = useState("=");
  const [forename, setForename] = useState("");
  const [surname, setSurname] = useState("");
  const [postCode, setPostCode] = useState("");
  const [middleNames, setMiddleNames] = useState("");
  const [title, setTitle] = useState("");
  const [gender, setGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [confirmedLearners, setConfirmedLearners] = useState("");
  const [orgContacts, setOrgContacts] = useState("");
  const [searchEnabled, setSearchEnabled] = useState(false);

  const { data: searchResults, isLoading: isSearchLoading } = useListStudents(
    { personCode, forename, surname, gender },
    { query: { enabled: searchEnabled } as any }
  );

  function handleSearch() {
    setSearchEnabled(true);
  }

  return (
    <>
      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatsCard 
          title="Attendance" 
          value={summary ? Math.round(summary.attendancePercent) : undefined} 
          unit="%" 
          colorClass="bg-emerald-600 text-white border-emerald-700" 
        />
        <StatsCard 
          title="Punctuality" 
          value={summary ? Math.round(summary.punctualityPercent) : undefined} 
          unit="%" 
          colorClass="bg-teal-600 text-white border-teal-700" 
        />
        <StatsCard 
          title="Registers" 
          value={summary?.registersCount} 
        />
        <StatsCard 
          title="At Risk" 
          value={summary?.atRiskCount} 
          colorClass="bg-red-50 text-red-700 border-red-200" 
        />
        <StatsCard 
          title="SMART Targets" 
          value={summary?.smartTargetsCount} 
        />
        <StatsCard 
          title="ILPs" 
          value={summary?.ilpsCount} 
        />
      </div>

      {/* Tabbed Search Panel */}
      <Card className="shadow-sm">
        <Tabs defaultValue="learner" className="w-full">
          <CardHeader className="p-0 border-b">
            <TabsList className="w-full justify-start rounded-none bg-slate-100/50 p-0 h-auto">
              {['Learner', 'Course', 'Register', 'Exam', 'Room', 'Staff'].map(tab => (
                <TabsTrigger 
                  key={tab} 
                  value={tab.toLowerCase()}
                  className="px-6 py-3 data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none"
                >
                  {tab}
                </TabsTrigger>
              ))}
            </TabsList>
          </CardHeader>
          <CardContent className="p-6">
            <TabsContent value="learner" className="mt-0 outline-none">
              <div className="space-y-0">
                {/* 2-column label+field layout matching reference */}
                <div className="grid grid-cols-2 gap-x-8">
                  {/* LEFT COLUMN */}
                  <div className="space-y-2">
                    {/* Person Code */}
                    <div className="flex items-center gap-2">
                      <span className="w-36 shrink-0 text-sm text-slate-700">Person Code</span>
                      <div className="flex flex-1 gap-1">
                        <Select value={personCodeOp} onValueChange={setPersonCodeOp}>
                          <SelectTrigger className="w-14 shrink-0 text-xs px-1.5 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="=">=</SelectItem>
                            <SelectItem value="!=">≠</SelectItem>
                            <SelectItem value="contains">~</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          value={personCode}
                          onChange={e => { setPersonCode(e.target.value); setSearchEnabled(false); }}
                          className="flex-1 h-8 text-sm"
                        />
                      </div>
                    </div>
                    {/* Surname */}
                    <div className="flex items-center gap-2">
                      <span className="w-36 shrink-0 text-sm text-slate-700">Surname</span>
                      <Input value={surname} onChange={e => { setSurname(e.target.value); setSearchEnabled(false); }} className="flex-1 h-8 text-sm" />
                    </div>
                    {/* Middle Names */}
                    <div className="flex items-center gap-2">
                      <span className="w-36 shrink-0 text-sm text-slate-700">Middle Names</span>
                      <Input value={middleNames} onChange={e => setMiddleNames(e.target.value)} className="flex-1 h-8 text-sm" />
                    </div>
                    {/* Gender */}
                    <div className="flex items-center gap-2">
                      <span className="w-36 shrink-0 text-sm text-slate-700">Gender</span>
                      <Select value={gender} onValueChange={v => { setGender(v); setSearchEnabled(false); }}>
                        <SelectTrigger className="flex-1 h-8 text-sm">
                          <SelectValue placeholder="" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                          <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Confirmed Learners */}
                    <div className="flex items-center gap-2">
                      <span className="w-36 shrink-0 text-sm text-slate-700">Confirmed Learners</span>
                      <Select value={confirmedLearners} onValueChange={setConfirmedLearners}>
                        <SelectTrigger className="flex-1 h-8 text-sm">
                          <SelectValue placeholder="" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">Yes</SelectItem>
                          <SelectItem value="no">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* RIGHT COLUMN */}
                  <div className="space-y-2">
                    {/* Forename */}
                    <div className="flex items-center gap-2">
                      <span className="w-36 shrink-0 text-sm text-slate-700">Forename</span>
                      <Input value={forename} onChange={e => { setForename(e.target.value); setSearchEnabled(false); }} className="flex-1 h-8 text-sm" />
                    </div>
                    {/* Post Code */}
                    <div className="flex items-center gap-2">
                      <span className="w-36 shrink-0 text-sm text-slate-700">Post Code</span>
                      <Input value={postCode} onChange={e => setPostCode(e.target.value)} className="flex-1 h-8 text-sm" />
                    </div>
                    {/* Title */}
                    <div className="flex items-center gap-2">
                      <span className="w-36 shrink-0 text-sm text-slate-700">Title</span>
                      <Select value={title} onValueChange={setTitle}>
                        <SelectTrigger className="flex-1 h-8 text-sm">
                          <SelectValue placeholder="" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Mr">Mr</SelectItem>
                          <SelectItem value="Mrs">Mrs</SelectItem>
                          <SelectItem value="Miss">Miss</SelectItem>
                          <SelectItem value="Ms">Ms</SelectItem>
                          <SelectItem value="Dr">Dr</SelectItem>
                          <SelectItem value="Prof">Prof</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Date of Birth */}
                    <div className="flex items-center gap-2">
                      <span className="w-36 shrink-0 text-sm text-slate-700">Date of Birth</span>
                      <div className="flex flex-1 gap-1">
                        <Select defaultValue="=">
                          <SelectTrigger className="w-14 shrink-0 text-xs px-1.5 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="=">=</SelectItem>
                            <SelectItem value="before">{"<"}</SelectItem>
                            <SelectItem value="after">{">"}</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="date"
                          value={dateOfBirth}
                          onChange={e => setDateOfBirth(e.target.value)}
                          className="flex-1 h-8 text-sm"
                        />
                      </div>
                    </div>
                    {/* Organisation Contacts */}
                    <div className="flex items-center gap-2">
                      <span className="w-36 shrink-0 text-sm text-slate-700">Organisation Contacts</span>
                      <Select value={orgContacts} onValueChange={setOrgContacts}>
                        <SelectTrigger className="flex-1 h-8 text-sm">
                          <SelectValue placeholder="" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="primary">Primary Contact</SelectItem>
                          <SelectItem value="emergency">Emergency Contact</SelectItem>
                          <SelectItem value="guardian">Guardian</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Search button — bottom right */}
                <div className="flex justify-end pt-3">
                  <Button onClick={handleSearch} disabled={isSearchLoading} className="gap-2 bg-sky-600 hover:bg-sky-700 text-white px-6 h-8 text-sm">
                    <Search className="w-3.5 h-3.5" /> Search
                  </Button>
                </div>

                {/* Search Results */}
                {searchEnabled && (
                  <div className="mt-4">
                    {isSearchLoading ? (
                      <div className="space-y-2 border rounded">
                        <div className="h-9 bg-slate-700 rounded-t" />
                        <div className="p-3 space-y-2">
                          <Skeleton className="h-8 w-full" />
                          <Skeleton className="h-8 w-full" />
                          <Skeleton className="h-8 w-full" />
                        </div>
                      </div>
                    ) : (
                      <LearnerSearchResults results={searchResults ?? []} />
                    )}
                  </div>
                )}
              </div>
            </TabsContent>
            <CourseSearchTab />
            <RegisterSearchTab />
            <ExamSearchTab />
            <RoomSearchTab />
            <StaffSearchTab />
          </CardContent>
        </Tabs>
      </Card>

      {/* Bottom Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Today's Schedule */}
        <Card className="col-span-1 shadow-sm">
          <CardHeader className="py-4 border-b bg-slate-50/50 flex flex-row items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Today's Schedule</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isScheduleLoading ? (
              <div className="p-4 space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : schedule?.length ? (
              <ul className="divide-y">
                {schedule.map(entry => (
                  <li key={entry.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                    <div>
                      <p className="font-semibold text-sm">{entry.courseName}</p>
                      <p className="text-xs text-muted-foreground">{entry.room} • {entry.staffName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{entry.startTime} - {entry.endTime}</p>
                      <Badge variant={entry.registerMarked ? "default" : "secondary"} className="mt-1 text-[10px]">
                        {entry.registerMarked ? "Marked" : "Pending"}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">No classes scheduled for today.</div>
            )}
          </CardContent>
        </Card>

        {/* Overdue Targets */}
        <Card className="col-span-1 shadow-sm border-red-200">
          <CardHeader className="py-4 border-b border-red-100 bg-red-50/30 flex flex-row items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <CardTitle className="text-base text-red-800">Overdue SMART Targets</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
             {isTargetsLoading ? (
               <div className="p-4 space-y-4">
                 <Skeleton className="h-12 w-full" />
                 <Skeleton className="h-12 w-full" />
               </div>
             ) : targets?.length ? (
               <ul className="divide-y divide-red-100">
                 {targets.map(target => (
                   <li key={target.id} className="p-4 hover:bg-red-50/50 transition-colors">
                     <div className="flex justify-between items-start mb-1">
                       <p className="font-semibold text-sm text-red-900">{target.title}</p>
                       <span className="text-xs font-medium text-red-600 bg-red-100 px-2 py-0.5 rounded">
                         Due {target.dueDate}
                       </span>
                     </div>
                     <p className="text-xs text-red-700/80 line-clamp-1">{target.studentName}</p>
                   </li>
                 ))}
               </ul>
             ) : (
               <div className="p-8 text-center text-sm text-muted-foreground">No overdue targets.</div>
             )}
          </CardContent>
        </Card>

        {/* My Courses */}
        <Card className="col-span-1 shadow-sm">
          <CardHeader className="py-4 border-b bg-slate-50/50 flex flex-row items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">My Courses</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
             {isCoursesLoading ? (
               <div className="p-4 space-y-4">
                 <Skeleton className="h-12 w-full" />
                 <Skeleton className="h-12 w-full" />
               </div>
             ) : courses?.length ? (
               <ul className="divide-y">
                 {courses.map(course => (
                   <li key={course.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                     <div>
                       <p className="font-semibold text-sm">{course.code}</p>
                       <p className="text-xs text-muted-foreground">{course.name}</p>
                     </div>
                     <Badge variant="outline">{course.enrolledCount} learners</Badge>
                   </li>
                 ))}
               </ul>
             ) : (
               <div className="p-8 text-center text-sm text-muted-foreground">No courses assigned.</div>
             )}
          </CardContent>
        </Card>

      </div>
    </>
  );
}
