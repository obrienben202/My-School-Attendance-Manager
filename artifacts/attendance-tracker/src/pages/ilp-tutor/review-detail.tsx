import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useListIlps } from "@workspace/api-client-react";
import { IlpTutorNav } from "./_nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, ChevronsRight, Paperclip, CheckCircle2, Clock, Upload, Star } from "lucide-react";
import { formatIlpDate, getReviewStatus } from "@/lib/ilp";

type QuestionType = "text" | "yesno" | "rating" | "dropdown" | "date" | "number";

type Question = {
  id: number;
  section: string;
  text: string;
  type: QuestionType;
  options?: string[];
};

type Answer = Record<number, string>;

const REVIEW_QUESTIONS: Question[] = [
  { id: 1, section: "Academic Progress", text: "How is the learner progressing academically this term?", type: "text" },
  { id: 2, section: "Academic Progress", text: "Are the learner's academic targets on track?", type: "yesno" },
  { id: 3, section: "Academic Progress", text: "Rate the learner's overall academic performance (1 = Needs significant support, 5 = Excellent).", type: "rating" },
  { id: 4, section: "Pastoral", text: "Any pastoral concerns to note?", type: "text" },
  { id: 5, section: "Pastoral", text: "How would you describe the learner's engagement?", type: "dropdown", options: ["Excellent", "Good", "Satisfactory", "Poor", "Very Poor"] },
  { id: 6, section: "Next Steps", text: "What are the agreed next steps for this learner?", type: "text" },
  { id: 7, section: "Next Steps", text: "Next review due date:", type: "date" },
];

type Tab = "review" | "files";

export default function ReviewDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { data: ilps = [], isLoading, isError } = useListIlps();
  const [tab, setTab] = useState<Tab>("review");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answer>({});
  const [comments, setComments] = useState<Record<number, string>>({});
  const [files, setFiles] = useState<string[]>([]);
  const [showComplete, setShowComplete] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const q = REVIEW_QUESTIONS[step];
  const total = REVIEW_QUESTIONS.length;
  const isLast = step === total - 1;
  const progress = Math.round(((step + 1) / total) * 100);
  const ilp = ilps.find((record) => record.id === Number(params.id));
  const reviewMeta = ilp ? {
    learnerName: ilp.studentName ?? "Unknown learner",
    reviewName: ilp.title,
    status: getReviewStatus(ilp),
    dueDate: ilp.nextReviewDue ?? ilp.lastReviewDate ?? ilp.createdAt,
  } : null;

  const setAnswer = (id: number, val: string) => setAnswers((prev) => ({ ...prev, [id]: val }));
  const setComment = (id: number, val: string) => setComments((prev) => ({ ...prev, [id]: val }));

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files).map((f) => f.name);
    setFiles((prev) => [...prev, ...dropped]);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []).map((f) => f.name);
    setFiles((prev) => [...prev, ...picked]);
  };

  if (isLoading) {
    return <div className="p-12 text-center text-sm text-gray-400">Loading review…</div>;
  }

  if (isError || !reviewMeta) {
    return <div className="p-12 text-center text-sm text-red-600">This ILP review could not be loaded.</div>;
  }

  if (submitted) {
    return (
      <div className="flex -mx-6 -mt-6 min-h-screen bg-slate-50">
        <IlpTutorNav active="Reviews" />
        <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Review Submitted</h2>
          <p className="text-sm text-gray-500 mb-6">
             The <strong>{reviewMeta.reviewName}</strong> for <strong>{reviewMeta.learnerName}</strong> has been submitted. Changes are now visible to the learner.
          </p>
          <Button className="bg-indigo-700 hover:bg-indigo-800" onClick={() => navigate("/ilp-tutor/reviews")}>
            Back to Reviews
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex -mx-6 -mt-6 min-h-screen bg-slate-50">
      <IlpTutorNav active="Reviews" />
      <div className="flex-1 min-w-0 overflow-auto">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="text-gray-400 hover:text-gray-700" onClick={() => navigate("/ilp-tutor/reviews")}>
              <ChevronLeft size={18} />
            </button>
            <div>
              <p className="font-bold text-gray-900 text-sm">{reviewMeta.reviewName}</p>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Star size={10} className="text-amber-400" />
                {reviewMeta.learnerName} · Due {formatIlpDate(reviewMeta.dueDate)}
              </p>
            </div>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded border font-medium ${
            reviewMeta.status === "Overdue"
              ? "bg-red-100 text-red-700 border-red-200"
              : reviewMeta.status === "In Progress"
                ? "bg-amber-100 text-amber-700 border-amber-200"
                : "bg-blue-100 text-blue-700 border-blue-200"
          }`}>
            <Clock size={10} className="inline mr-1" />{reviewMeta.status}
          </span>
        </div>

        {/* Tabs */}
        <div className="bg-white border-b border-gray-200 px-6 flex">
          {(["review", "files"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize flex items-center gap-1.5 ${
                tab === t ? "border-indigo-600 text-indigo-700" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "files" && <Paperclip size={13} />}
              {t === "review" ? "Review Questions" : `Files (${files.length})`}
            </button>
          ))}
        </div>

        <div className="p-6 max-w-2xl mx-auto">
          {tab === "review" ? (
            <>
              {/* Progress */}
              <div className="mb-6">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Question {step + 1} of {total}</span>
                  <span>{progress}% complete</span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
                {/* Section pills */}
                <div className="flex gap-2 mt-3 flex-wrap">
                  {[...new Set(REVIEW_QUESTIONS.map((q) => q.section))].map((sec) => (
                    <span key={sec} className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                      sec === q.section ? "bg-indigo-100 text-indigo-700 border-indigo-200" : "bg-gray-100 text-gray-400 border-gray-200"
                    }`}>{sec}</span>
                  ))}
                </div>
              </div>

              {/* Question card */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4 shadow-sm">
                <p className="text-xs font-bold text-indigo-500 uppercase tracking-wide mb-2">{q.section}</p>
                <p className="text-gray-900 font-semibold text-base mb-4">{q.text}</p>

                {/* Answer input by type */}
                {q.type === "text" && (
                  <Textarea
                    className="text-sm"
                    rows={4}
                    placeholder="Enter your response…"
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                  />
                )}
                {q.type === "yesno" && (
                  <div className="flex gap-3">
                    {["Yes", "No"].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setAnswer(q.id, opt)}
                        className={`px-6 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          answers[q.id] === opt
                            ? "bg-indigo-700 text-white border-indigo-700"
                            : "bg-white text-gray-700 border-gray-300 hover:border-indigo-400"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
                {q.type === "rating" && (
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => setAnswer(q.id, String(n))}
                        className={`w-10 h-10 rounded-full border text-sm font-bold transition-colors ${
                          answers[q.id] === String(n)
                            ? "bg-indigo-700 text-white border-indigo-700"
                            : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                    <span className="text-xs text-gray-400 self-center ml-2">
                      {answers[q.id] ? `Selected: ${answers[q.id]}` : ""}
                    </span>
                  </div>
                )}
                {q.type === "dropdown" && (
                  <Select value={answers[q.id] ?? ""} onValueChange={(v) => setAnswer(q.id, v)}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {(q.options ?? []).map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                {q.type === "date" && (
                  <Input type="date" className="w-48 text-sm" value={answers[q.id] ?? ""} onChange={(e) => setAnswer(q.id, e.target.value)} />
                )}
                {q.type === "number" && (
                  <Input type="number" className="w-32 text-sm" placeholder="0" value={answers[q.id] ?? ""} onChange={(e) => setAnswer(q.id, e.target.value)} />
                )}

                {/* Comments */}
                <div className="mt-4">
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Comments (optional)</label>
                  <Textarea
                    className="text-sm"
                    rows={2}
                    placeholder="Add any additional comments…"
                    value={comments[q.id] ?? ""}
                    onChange={(e) => setComment(q.id, e.target.value)}
                  />
                </div>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="gap-1">
                  <ChevronLeft size={14} /> Previous
                </Button>
                <Button variant="ghost" size="sm" className="text-gray-400 text-xs" onClick={() => navigate("/ilp-tutor/reviews")}>
                  Finish Later
                </Button>
                {isLast ? (
                  <Button size="sm" className="bg-green-700 hover:bg-green-800 gap-1" onClick={() => setShowComplete(true)}>
                    <CheckCircle2 size={14} /> Complete my submission
                  </Button>
                ) : (
                  <div className="flex gap-1">
                    <Button size="sm" className="bg-indigo-700 hover:bg-indigo-800 gap-1" onClick={() => setStep((s) => Math.min(total - 1, s + 1))}>
                      Next <ChevronRight size={14} />
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setStep(total - 1)} title="Skip to final page">
                      <ChevronsRight size={14} />
                    </Button>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Files tab */
            <div>
              <p className="text-sm text-gray-700 font-semibold mb-3">Attachments</p>
              <div
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${dragOver ? "border-indigo-400 bg-indigo-50" : "border-gray-300 bg-white"}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <Upload className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-500 mb-2">Drag files here or click <strong>Select file</strong></p>
                <label className="cursor-pointer">
                  <span className="text-sm text-indigo-700 font-semibold underline">SELECT FILE</span>
                  <input type="file" multiple className="hidden" onChange={handleFileInput} />
                </label>
              </div>
              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 bg-white border border-gray-200 rounded px-3 py-2 text-sm text-gray-700">
                      <Paperclip size={13} className="text-gray-400 shrink-0" /> {f}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Submit confirm */}
      <Dialog open={showComplete} onOpenChange={setShowComplete}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Complete Review Submission?</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">
             Submit the <strong>{reviewMeta.reviewName}</strong> for <strong>{reviewMeta.learnerName}</strong>?
          </p>
          <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded p-2 mt-1">
            Changes are visible to the learner once the review screen is saved.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowComplete(false)}>Cancel</Button>
            <Button className="bg-green-700 hover:bg-green-800" onClick={() => { setShowComplete(false); setSubmitted(true); }}>
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
