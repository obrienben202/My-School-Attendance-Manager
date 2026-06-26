import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { IlpAdminNav } from "./_nav";
import { PlusCircle, MoreHorizontal, Pencil, Trash2, Star, ChevronDown, ChevronUp, Plus, X } from "lucide-react";

type Question = { id: number; text: string; type: string; sectionId: number };
type Section = { id: number; name: string };
type Review = {
  id: number;
  name: string;
  description: string;
  sections: Section[];
  questions: Question[];
  createdAt: string;
};

const MOCK_REVIEWS: Review[] = [
  {
    id: 1, name: "Mid-Year Review", description: "Half-term progress check-in.", createdAt: "2024-09-01",
    sections: [{ id: 1, name: "Academic Progress" }, { id: 2, name: "Pastoral" }],
    questions: [
      { id: 1, text: "How is the learner progressing academically?", type: "Text", sectionId: 1 },
      { id: 2, text: "Are targets on track?", type: "Yes/No", sectionId: 1 },
      { id: 3, text: "Any pastoral concerns?", type: "Text", sectionId: 2 },
    ],
  },
  {
    id: 2, name: "End-of-Year Review", description: "Annual review with learner and tutor.", createdAt: "2024-09-05",
    sections: [{ id: 4, name: "Achievement" }, { id: 5, name: "Next Steps" }],
    questions: [
      { id: 5, text: "What have you achieved this year?", type: "Text", sectionId: 4 },
      { id: 6, text: "What are your goals for next year?", type: "Text", sectionId: 5 },
    ],
  },
  {
    id: 3, name: "Initial Assessment Review", description: "Review conducted at enrolment.", createdAt: "2024-08-20",
    sections: [{ id: 6, name: "Entry Information" }],
    questions: [
      { id: 7, text: "What are your aspirations?", type: "Text", sectionId: 6 },
      { id: 8, text: "Any support needs?", type: "Text", sectionId: 6 },
    ],
  },
];

const QUESTION_TYPES = ["Text", "Yes/No", "Rating 1–5", "Multiple Choice", "Date"];

export default function IlpReviews() {
  const [reviews, setReviews] = useState<Review[]>(MOCK_REVIEWS);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<Review | null>(null);
  const [showDelete, setShowDelete] = useState<Review | null>(null);
  const [showAddQ, setShowAddQ] = useState<Review | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [newQ, setNewQ] = useState({ text: "", type: "Text", sectionId: 0 });

  const openCreate = () => { setForm({ name: "", description: "" }); setShowCreate(true); };
  const openEdit = (r: Review) => { setForm({ name: r.name, description: r.description }); setShowEdit(r); };

  const doCreate = () => {
    setReviews((prev) => [
      ...prev,
      { id: Date.now(), name: form.name, description: form.description, sections: [], questions: [], createdAt: new Date().toISOString().split("T")[0] },
    ]);
    setShowCreate(false);
  };

  const doEdit = () => {
    setReviews((prev) => prev.map((r) => r.id === showEdit?.id ? { ...r, ...form } : r));
    setShowEdit(null);
  };

  const doDelete = () => {
    setReviews((prev) => prev.filter((r) => r.id !== showDelete?.id));
    setShowDelete(null);
  };

  const doAddQuestion = () => {
    if (!showAddQ || !newQ.text) return;
    setReviews((prev) => prev.map((r) => r.id === showAddQ.id
      ? { ...r, questions: [...r.questions, { id: Date.now(), text: newQ.text, type: newQ.type, sectionId: newQ.sectionId }] }
      : r
    ));
    setShowAddQ(null);
    setNewQ({ text: "", type: "Text", sectionId: 0 });
  };

  const removeQuestion = (reviewId: number, qId: number) => {
    setReviews((prev) => prev.map((r) => r.id === reviewId ? { ...r, questions: r.questions.filter((q) => q.id !== qId) } : r));
  };

  return (
    <div className="flex -mx-6 -mt-6 min-h-screen bg-slate-50">
      <IlpAdminNav active="Reviews" />
      <div className="flex-1 min-w-0 overflow-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Reviews</h1>
            <p className="text-sm text-gray-500 mt-0.5">Create and manage ILP reviews with configurable questions and sections.</p>
          </div>
          <Button onClick={openCreate} className="gap-2 bg-teal-700 hover:bg-teal-800">
            <PlusCircle size={15} /> Create Review
          </Button>
        </div>

        <div className="space-y-3">
          {reviews.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center text-gray-400">No reviews created yet.</div>
          )}
          {reviews.map((r) => {
            const isExpanded = expanded === r.id;
            return (
              <div key={r.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                {/* Review header row */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Star size={15} className="text-amber-400 shrink-0" />
                    <div>
                      <button
                        className="font-semibold text-gray-900 hover:text-teal-700 text-sm text-left"
                        onClick={() => setExpanded(isExpanded ? null : r.id)}
                      >
                        {r.name}
                      </button>
                      {r.description && <p className="text-xs text-gray-400 mt-0.5">{r.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-gray-400">{r.sections.length} section{r.sections.length !== 1 ? "s" : ""}</span>
                    <span className="text-xs text-gray-400">{r.questions.length} question{r.questions.length !== 1 ? "s" : ""}</span>
                    <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString("en-GB")}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 hover:bg-gray-100 rounded"><MoreHorizontal size={15} /></button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="text-sm">
                        <DropdownMenuItem onClick={() => openEdit(r)}><Pencil size={13} className="mr-2" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setShowAddQ(r); setNewQ({ text: "", type: "Text", sectionId: r.sections[0]?.id ?? 0 }); }}>
                          <Plus size={13} className="mr-2" /> Add Question
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => setShowDelete(r)}><Trash2 size={13} className="mr-2" /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <button onClick={() => setExpanded(isExpanded ? null : r.id)} className="p-1 text-gray-400 hover:text-gray-600">
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                  </div>
                </div>

                {/* Expanded questions & sections */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Questions &amp; Sections</p>
                    {r.sections.length === 0 && r.questions.length === 0 && (
                      <p className="text-xs text-gray-400 italic">No questions yet. Use ⋮ → Add Question to get started.</p>
                    )}
                    {r.sections.map((sec) => {
                      const sectionQs = r.questions.filter((q) => q.sectionId === sec.id);
                      return (
                        <div key={sec.id} className="mb-4">
                          <p className="text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> {sec.name}
                          </p>
                          {sectionQs.length === 0 ? (
                            <p className="text-xs text-gray-400 ml-3 italic">No questions in this section.</p>
                          ) : (
                            <div className="space-y-1 ml-3">
                              {sectionQs.map((q) => (
                                <div key={q.id} className="flex items-center justify-between bg-white border border-gray-200 rounded px-3 py-1.5 text-xs">
                                  <span className="text-gray-700">{q.text}</span>
                                  <div className="flex items-center gap-2 ml-3 shrink-0">
                                    <span className="text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{q.type}</span>
                                    <button onClick={() => removeQuestion(r.id, q.id)} className="text-gray-300 hover:text-red-400"><X size={11} /></button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {/* Questions with no section */}
                    {r.questions.filter((q) => !r.sections.find((s) => s.id === q.sectionId)).length > 0 && (
                      <div className="mb-2">
                        <p className="text-xs font-semibold text-gray-500 mb-1.5">Unsectioned</p>
                        <div className="space-y-1 ml-3">
                          {r.questions.filter((q) => !r.sections.find((s) => s.id === q.sectionId)).map((q) => (
                            <div key={q.id} className="flex items-center justify-between bg-white border border-gray-200 rounded px-3 py-1.5 text-xs">
                              <span className="text-gray-700">{q.text}</span>
                              <div className="flex items-center gap-2 ml-3 shrink-0">
                                <span className="text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{q.type}</span>
                                <button onClick={() => removeQuestion(r.id, q.id)} className="text-gray-300 hover:text-red-400"><X size={11} /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => { setShowAddQ(r); setNewQ({ text: "", type: "Text", sectionId: r.sections[0]?.id ?? 0 }); }}
                      className="mt-2 flex items-center gap-1 text-xs text-teal-700 hover:text-teal-800 font-medium"
                    >
                      <Plus size={12} /> Add Question
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Create review */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Create Review</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Review Name *</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Mid-Year Review" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Description</label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="text-sm" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={doCreate} disabled={!form.name.trim()} className="bg-teal-700 hover:bg-teal-800">Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit review */}
        <Dialog open={!!showEdit} onOpenChange={() => setShowEdit(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Edit Review</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Review Name *</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Description</label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="text-sm" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEdit(null)}>Cancel</Button>
              <Button onClick={doEdit} disabled={!form.name.trim()} className="bg-teal-700 hover:bg-teal-800">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete review */}
        <Dialog open={!!showDelete} onOpenChange={() => setShowDelete(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Delete Review?</DialogTitle></DialogHeader>
            <p className="text-sm text-gray-600">Delete <strong>{showDelete?.name}</strong>? This cannot be undone.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDelete(null)}>Cancel</Button>
              <Button variant="destructive" onClick={doDelete}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Question */}
        <Dialog open={!!showAddQ} onOpenChange={() => setShowAddQ(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add Question to "{showAddQ?.name}"</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Question Text *</label>
                <Textarea value={newQ.text} onChange={(e) => setNewQ({ ...newQ, text: e.target.value })} rows={2} className="text-sm" placeholder="Enter question…" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Answer Type</label>
                <Select value={newQ.type} onValueChange={(v) => setNewQ({ ...newQ, type: v })}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{QUESTION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {showAddQ && showAddQ.sections.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Section</label>
                  <Select value={String(newQ.sectionId)} onValueChange={(v) => setNewQ({ ...newQ, sectionId: Number(v) })}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Unsectioned</SelectItem>
                      {showAddQ.sections.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddQ(null)}>Cancel</Button>
              <Button onClick={doAddQuestion} disabled={!newQ.text.trim()} className="bg-teal-700 hover:bg-teal-800">Add Question</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
