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
                <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="flex-1 h-8 text-sm" placeholder="--:--" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-32 shrink-0 text-sm text-slate-700">Session</span>
              <Select value={session} onValueChange={setSession}>
                <SelectTrigger className="flex-1 h-8 text-sm"><SelectValue placeholder="" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Current Year</SelectItem>
                  <SelectItem value="2024">2024/2025</SelectItem>
                  <SelectItem value="2023">2023/2024</SelectItem>
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
            <RegisterSearchResults results={results ?? []} />
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
    { query: { enabled: searchEnabled } }
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
            {['exam', 'room', 'staff'].map(tab => (
              <TabsContent key={tab} value={tab} className="mt-0 outline-none text-sm text-muted-foreground py-4">
                Search interface for {tab}s...
              </TabsContent>
            ))}
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
