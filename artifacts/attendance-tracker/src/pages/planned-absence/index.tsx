import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListPlannedAbsencesQueryKey,
  useCreatePlannedAbsence,
  useListPlannedAbsences,
  useListStudents,
  type PlannedAbsence,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { AlertTriangle, CalendarOff, Check, ChevronRight, Clock, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  plannedAbsenceErrorMessage,
  validatePlannedAbsenceDraft,
} from "@/lib/planned-absence";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ABSENCE_REASONS = [
  "All reasons",
  "Holiday / Vacation",
  "University Visit",
  "Religious Holiday",
  "Medical Appointment",
  "Bereavement",
  "Sports / Match",
  "Work Experience",
  "Other",
];

type CreateStep = "learner" | "dates" | "reason" | "review";
type DateType = "single" | "range" | "mixed";
type SelectedLearner = {
  id: number;
  name: string;
  personCode: string;
  attendance: string;
};

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function localToday() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function PendingBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
      <Clock size={11} /> Pending
    </span>
  );
}

export default function PlannedAbsence() {
  const createRequested = new URLSearchParams(window.location.search).get("create") === "1";
  const [activeTab, setActiveTab] = useState<"view" | "create">(createRequested ? "create" : "view");

  return (
    <div className="-mx-6 -mt-6 min-h-screen bg-slate-50">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mb-0.5 flex items-center gap-2">
          <CalendarOff size={18} className="text-teal-700" />
          <h1 className="text-xl font-bold text-gray-900">Planned Absence</h1>
        </div>
        <p className="text-sm text-gray-500">
          Submit planned absence requests and review the requests you have already sent.
        </p>
      </div>

      <div className="flex gap-0 border-b border-gray-200 bg-white px-6">
        {(["create", "view"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`border-b-2 px-5 py-3 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? "border-teal-700 text-teal-700"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            {tab === "create" ? "Request an absence" : "View my requests"}
          </button>
        ))}
      </div>

      {activeTab === "view" ? <ViewAbsences /> : <CreateAbsence onCreated={() => setActiveTab("view")} />}
    </div>
  );
}

function ViewAbsences() {
  const { data: absences = [], isLoading, isError, refetch } = useListPlannedAbsences();
  const [learner, setLearner] = useState("");
  const [personCode, setPersonCode] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("All reasons");

  const results = useMemo(() => {
    const learnerQuery = learner.trim().toLowerCase();
    const codeQuery = personCode.trim().toLowerCase();
    return absences.filter((absence) => {
      if (learnerQuery && !absence.learnerName.toLowerCase().includes(learnerQuery)) return false;
      if (codeQuery && !absence.personCode.toLowerCase().includes(codeQuery)) return false;
      if (reason !== "All reasons" && absence.reason !== reason) return false;
      if (fromDate && absence.fromDate < fromDate) return false;
      if (toDate && absence.toDate > toDate) return false;
      return true;
    });
  }, [absences, fromDate, learner, personCode, reason, toDate]);

  return (
    <div>
      <div className="border-b border-gray-200 bg-white px-6 py-5">
        <div className="grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Learner name</label>
            <Input value={learner} onChange={(event) => setLearner(event.target.value)} placeholder="Name…" className="text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Person code</label>
            <Input value={personCode} onChange={(event) => setPersonCode(event.target.value)} placeholder="Person code…" className="text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Absence reason</label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ABSENCE_REASONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Starting from</label>
            <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Ending by</label>
            <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="text-sm" />
          </div>
        </div>
      </div>

      <div className="border-b border-amber-100 bg-amber-50 px-6 py-2 text-xs text-amber-800">
        Requests are saved as <strong>pending</strong>. No approval or register change is implied.
      </div>

      {isLoading ? (
        <div className="px-6 py-16 text-center text-sm text-gray-400">Loading saved requests…</div>
      ) : isError ? (
        <div className="px-6 py-16 text-center">
          <p className="mb-3 text-sm text-red-600">Saved requests could not be loaded.</p>
          <Button variant="outline" onClick={() => refetch()}>Try again</Button>
        </div>
      ) : results.length === 0 ? (
        <div className="px-6 py-16 text-center text-sm text-gray-400">
          {absences.length === 0 ? "You have not submitted a planned absence request yet." : "No requests match these filters."}
        </div>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-gray-300 bg-gray-100">
                {["Learner", "Person code", "Reason", "Date(s)", "Type", "Submitted by", "Status"].map((heading) => (
                  <th key={heading} className="px-4 py-2.5 text-left font-semibold text-gray-700">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((row, index) => (
                <tr key={row.id} className={`${index % 2 === 0 ? "bg-white" : "bg-slate-50/60"} border-b border-gray-100`}>
                  <td className="px-4 py-2.5 font-semibold text-gray-800">{row.learnerName}</td>
                  <td className="px-4 py-2.5 font-mono text-gray-500">{row.personCode}</td>
                  <td className="px-4 py-2.5 text-gray-700">{row.reason}</td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {row.fromDate === row.toDate ? formatDate(row.fromDate) : `${formatDate(row.fromDate)} – ${formatDate(row.toDate)}`}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">
                    {row.partDay ? `Part day (${row.startTime}–${row.endTime})` : "Full day"}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{row.submittedBy}</td>
                  <td className="px-4 py-2.5"><PendingBadge /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-400">
            {results.length} request{results.length === 1 ? "" : "s"}
          </div>
        </div>
      )}
    </div>
  );
}

function CreateAbsence({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: students = [], isLoading: studentsLoading, isError: studentsError } = useListStudents();
  const createAbsence = useCreatePlannedAbsence();
  const [step, setStep] = useState<CreateStep>("learner");
  const [learnerSearch, setLearnerSearch] = useState("");
  const [selectedLearner, setSelectedLearner] = useState<SelectedLearner | null>(null);
  const [dateType, setDateType] = useState<DateType>("single");
  const [singleDate, setSingleDate] = useState("");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [partDay, setPartDay] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [reason, setReason] = useState("none");
  const [notes, setNotes] = useState("");
  const [validationError, setValidationError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState<PlannedAbsence | null>(null);

  const filteredStudents = useMemo(() => {
    const query = learnerSearch.toLowerCase();
    return students
      .filter((student) =>
        `${student.forename} ${student.surname}`.toLowerCase().includes(query)
        || student.personCode.toLowerCase().includes(query))
      .slice(0, 8);
  }, [learnerSearch, students]);

  const selectLearner = (student: (typeof students)[number]) => {
    setSelectedLearner({
      id: student.id,
      name: `${student.surname}, ${student.forename}`,
      personCode: student.personCode,
      attendance: `${student.attendancePercent}%`,
    });
    setLearnerSearch("");
    setValidationError("");
    setStep("dates");
  };

  useEffect(() => {
    if (selectedLearner || students.length === 0 || !user?.firstName || !user.lastName) return;
    const firstName = user.firstName.trim().toLowerCase();
    const lastName = user.lastName.trim().toLowerCase();
    const match = students.find((student) =>
      student.forename.trim().toLowerCase() === firstName
      && student.surname.trim().toLowerCase() === lastName);
    if (match) selectLearner(match);
  }, [selectedLearner, students, user?.firstName, user?.lastName]);

  const reset = () => {
    setStep("learner");
    setSelectedLearner(null);
    setLearnerSearch("");
    setDateType("single");
    setSingleDate("");
    setRangeFrom("");
    setRangeTo("");
    setPartDay(false);
    setStartTime("09:00");
    setEndTime("17:00");
    setReason("none");
    setNotes("");
    setValidationError("");
    setSubmitError("");
    setSubmitted(null);
  };

  const validateDates = () => {
    return validatePlannedAbsenceDraft({
      dateType,
      singleDate,
      rangeFrom,
      rangeTo,
      partDay,
      startTime,
      endTime,
    }, localToday());
  };

  const continueFromDates = () => {
    const error = validateDates();
    setValidationError(error);
    if (!error) setStep("reason");
  };

  const continueFromReason = () => {
    const error = reason === "none" ? "Select an absence reason." : "";
    setValidationError(error);
    if (!error) setStep("review");
  };

  const submit = async () => {
    if (!selectedLearner) {
      setSubmitError("Select a learner before submitting.");
      setStep("learner");
      return;
    }
    const dateError = validateDates();
    if (dateError || reason === "none") {
      setSubmitError(dateError || "Select an absence reason.");
      return;
    }

    setSubmitError("");
    const fromDate = dateType === "single" ? singleDate : rangeFrom;
    const toDate = dateType === "single" ? singleDate : rangeTo;
    try {
      const created = await createAbsence.mutateAsync({
        data: {
          studentId: selectedLearner.id,
          fromDate,
          toDate,
          reason,
          partDay,
          ...(partDay ? { startTime, endTime } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        },
      });
      await queryClient.invalidateQueries({ queryKey: getListPlannedAbsencesQueryKey() });
      setSubmitted(created);
    } catch (error) {
      setSubmitError(plannedAbsenceErrorMessage(error));
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
          <Check size={28} className="text-green-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-800">Absence request saved</h2>
        <p className="max-w-sm text-center text-sm text-gray-500">
          The planned absence for <strong>{submitted.learnerName}</strong> has been saved with a <strong>pending</strong> status.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCreated}>View my requests</Button>
          <Button className="bg-teal-700 hover:bg-teal-800" onClick={reset}>Create another request</Button>
        </div>
      </div>
    );
  }

  const steps: CreateStep[] = ["learner", "dates", "reason", "review"];
  const stepLabels: Record<CreateStep, string> = {
    learner: "Select Learner",
    dates: "Absence Dates",
    reason: "Reason",
    review: "Review & Submit",
  };

  return (
    <div className="max-w-2xl px-6 py-6">
      <div className="mb-8 flex items-center">
        {steps.map((item, index) => (
          <div key={item} className="flex items-center">
            <div className={`flex items-center gap-2 text-xs font-semibold ${step === item ? "text-teal-700" : steps.indexOf(step) > index ? "text-green-600" : "text-gray-400"}`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-bold ${step === item ? "border-teal-700 bg-teal-700 text-white" : steps.indexOf(step) > index ? "border-green-400 bg-green-100 text-green-700" : "border-gray-300 bg-white text-gray-400"}`}>
                {steps.indexOf(step) > index ? <Check size={10} /> : index + 1}
              </span>
              <span className="hidden sm:block">{stepLabels[item]}</span>
            </div>
            {index < steps.length - 1 && <div className={`mx-2 h-px w-8 ${steps.indexOf(step) > index ? "bg-green-400" : "bg-gray-200"}`} />}
          </div>
        ))}
      </div>

      {step === "learner" && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-gray-800">Select a learner</h2>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input value={learnerSearch} onChange={(event) => setLearnerSearch(event.target.value)} placeholder="Search by name or person code…" className="pl-8 text-sm" autoFocus />
          </div>
          {studentsLoading && <p className="text-sm text-gray-400">Loading learners…</p>}
          {studentsError && <p className="text-sm text-red-600">Learners could not be loaded. Refresh and try again.</p>}
          {learnerSearch.length > 0 && !studentsLoading && (
            <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
              {filteredStudents.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-400">No learners found.</p>
              ) : filteredStudents.map((student) => (
                <button key={student.id} onClick={() => selectLearner(student)} className="flex w-full items-center justify-between border-b border-gray-100 px-4 py-2.5 transition-colors last:border-0 hover:bg-teal-50">
                  <span className="text-sm font-medium text-gray-800">{student.surname}, {student.forename}</span>
                  <span className="font-mono text-xs text-gray-400">{student.personCode}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === "dates" && selectedLearner && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-bold text-gray-800">Absence dates</h2>
            <p className="text-xs text-gray-500">Recording for <strong>{selectedLearner.name}</strong> ({selectedLearner.personCode})</p>
          </div>
          <div className="space-y-2">
            {([
              { value: "single", label: "One day or part of one day" },
              { value: "range", label: "More than one full day" },
              { value: "mixed", label: "Parts of days and full days" },
            ] as { value: DateType; label: string }[]).map((option) => (
              <label key={option.value} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                <input type="radio" name="dateType" checked={dateType === option.value} onChange={() => { setDateType(option.value); setPartDay(false); setValidationError(""); }} className="accent-teal-600" />
                {option.label}
              </label>
            ))}
          </div>
          {dateType === "single" && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">Date <span className="text-red-500">*</span></label>
                <Input type="date" min={localToday()} value={singleDate} onChange={(event) => setSingleDate(event.target.value)} className="w-48 text-sm" />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={partDay} onChange={(event) => setPartDay(event.target.checked)} className="accent-teal-600" />
                Part of the day only
              </label>
              {partDay && (
                <div className="flex gap-4 pl-6">
                  <div><label className="mb-1 block text-xs font-semibold text-gray-600">Start time</label><Input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="w-32 text-sm" /></div>
                  <div><label className="mb-1 block text-xs font-semibold text-gray-600">End time</label><Input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className="w-32 text-sm" /></div>
                </div>
              )}
            </div>
          )}
          {dateType === "range" && (
            <div className="flex gap-4">
              <div><label className="mb-1 block text-xs font-semibold text-gray-600">From <span className="text-red-500">*</span></label><Input type="date" min={localToday()} value={rangeFrom} onChange={(event) => setRangeFrom(event.target.value)} className="w-40 text-sm" /></div>
              <div><label className="mb-1 block text-xs font-semibold text-gray-600">To <span className="text-red-500">*</span></label><Input type="date" min={rangeFrom || localToday()} value={rangeTo} onChange={(event) => setRangeTo(event.target.value)} className="w-40 text-sm" /></div>
            </div>
          )}
          {dateType === "mixed" && (
            <div className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              Record each part-day and full-day period as a separate request.
            </div>
          )}
          {validationError && <p className="text-sm text-red-600">{validationError}</p>}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setStep("learner")}>Back</Button>
            <Button className="bg-teal-700 hover:bg-teal-800" onClick={continueFromDates} disabled={dateType === "mixed"}>
              Continue <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}

      {step === "reason" && (
        <div className="space-y-5">
          <h2 className="text-base font-bold text-gray-800">Absence reason</h2>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Absence reason <span className="text-red-500">*</span></label>
            <Select value={reason} onValueChange={(value) => { setReason(value); setValidationError(""); }}>
              <SelectTrigger className="w-72 text-sm"><SelectValue placeholder="Select reason…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Select reason —</SelectItem>
                {ABSENCE_REASONS.slice(1).map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Notes</label>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Additional notes…" className="w-full resize-none rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
          </div>
          {validationError && <p className="text-sm text-red-600">{validationError}</p>}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setStep("dates")}>Back</Button>
            <Button className="bg-teal-700 hover:bg-teal-800" onClick={continueFromReason}>Continue <ChevronRight size={14} /></Button>
          </div>
        </div>
      )}

      {step === "review" && selectedLearner && (
        <div className="space-y-5">
          <h2 className="text-base font-bold text-gray-800">Review and submit</h2>
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-gray-600">Learner</p>
            <div className="flex items-center gap-3">
              <span className="font-bold text-gray-800">{selectedLearner.name}</span>
              <span className="font-mono text-xs text-gray-400">{selectedLearner.personCode}</span>
            </div>
          </div>
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 text-sm">
            {[
              ["Absence reason", reason],
              ["Date(s)", dateType === "single" ? formatDate(singleDate) : `${formatDate(rangeFrom)} – ${formatDate(rangeTo)}`],
              ["Type", partDay ? `Part day (${startTime}–${endTime})` : "Full day"],
              ["Notes", notes || "—"],
              ["Status after submission", "Pending"],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-4 px-4 py-2.5">
                <span className="w-36 shrink-0 text-xs text-gray-500">{label}</span>
                <span className="text-gray-800">{value}</span>
              </div>
            ))}
          </div>
          {submitError && (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {submitError}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setStep("reason")} disabled={createAbsence.isPending}>Back</Button>
            <Button className="gap-1.5 bg-teal-700 hover:bg-teal-800" onClick={submit} disabled={createAbsence.isPending}>
              {createAbsence.isPending ? "Saving request…" : <><Plus size={14} /> Submit request</>}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}