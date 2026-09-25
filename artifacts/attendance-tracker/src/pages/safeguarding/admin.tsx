import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Shield, Tag, Target, Users, FileText, StickyNote, AlertTriangle,
  Bell, Plus, Pencil, Trash2, Check, X, Clock, Settings,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Category = { id: number; name: string; colour: string; description: string };
type KPI = { id: number; name: string; description: string; target: string };
type DistributionList = { id: number; name: string; members: string[] };
type Template = { id: number; name: string; category: string; urgent: boolean; visibility: string; description: string };
type AdminTab = "categories" | "kpis" | "distribution" | "record-templates" | "note-templates" | "risk-templates" | "notifications";

// ─── Sample data ───────────────────────────────────────────────────────────────

const COLOURS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];

const initCategories: Category[] = [
  { id: 1, name: "Wellbeing", colour: "#22c55e", description: "General learner welfare and wellbeing concerns" },
  { id: 2, name: "Behaviour", colour: "#f97316", description: "Disciplinary incidents and behaviour concerns" },
  { id: 3, name: "Disclosure", colour: "#ef4444", description: "Learner disclosures requiring immediate action" },
  { id: 4, name: "Attendance Concern", colour: "#eab308", description: "Persistent or unexplained absence patterns" },
  { id: 5, name: "Mental Health", colour: "#8b5cf6", description: "Mental health concerns and support referrals" },
  { id: 6, name: "Financial Hardship", colour: "#3b82f6", description: "Financial difficulties affecting learning" },
];

const initKPIs: KPI[] = [
  { id: 1, name: "Response Time", description: "Time from concern raised to first contact", target: "Within 24 hours" },
  { id: 2, name: "Case Resolution", description: "Percentage of cases closed within 30 days", target: "80%" },
  { id: 3, name: "Follow-up Completion", description: "Follow-up notes added to all open records", target: "100%" },
];

const initDistLists: DistributionList[] = [
  { id: 1, name: "Pastoral Team", members: ["Head of Pastoral", "Deputy Head", "SENCO", "Student Services"] },
  { id: 2, name: "Safeguarding Managers", members: ["DSL Lead", "Deputy DSL"] },
  { id: 3, name: "Attendance Officers", members: ["Attendance Manager", "Head of Year", "Tutor"] },
];

const initRecordTemplates: Template[] = [
  { id: 1, name: "Disciplinary Meeting", category: "Behaviour", urgent: false, visibility: "Notified staff only", description: "Template for recording formal disciplinary meetings" },
  { id: 2, name: "Disclosure Record", category: "Disclosure", urgent: true, visibility: "Safeguarding Managers", description: "Template for recording learner disclosures — urgent by default" },
  { id: 3, name: "Welfare Check", category: "Wellbeing", urgent: false, visibility: "All staff", description: "General welfare check record" },
];

const initNoteTemplates: Template[] = [
  { id: 1, name: "Follow-up Note", category: "Wellbeing", urgent: false, visibility: "Notified staff only", description: "Standard follow-up note for ongoing cases" },
  { id: 2, name: "Attendance Note", category: "Attendance Concern", urgent: false, visibility: "All staff", description: "Note for persistent absence follow-up" },
];

const initRiskTemplates: Template[] = [
  { id: 1, name: "At-Risk Flag", category: "Mental Health", urgent: true, visibility: "Safeguarding Managers", description: "Flag for learners identified as at-risk" },
  { id: 2, name: "Financial Risk", category: "Financial Hardship", urgent: false, visibility: "Notified staff only", description: "Flag for significant financial hardship" },
];

const NOTIFY_INTERVALS = ["Immediately", "Every 1 hour", "Every 2 hours", "Every 4 hours", "Every 6 hours", "Every 12 hours", "Every 24 hours"];
const VISIBILITY_OPTIONS = ["Notified staff only", "All staff", "Safeguarding Managers", "Specified list"];

// ─── Main component ────────────────────────────────────────────────────────────

export default function SafeguardingAdmin() {
  const [activeTab, setActiveTab] = useState<AdminTab>("categories");

  const [categories, setCategories] = useState<Category[]>(initCategories);
  const [kpis, setKPIs] = useState<KPI[]>(initKPIs);
  const [distLists, setDistLists] = useState<DistributionList[]>(initDistLists);
  const [recordTemplates, setRecordTemplates] = useState<Template[]>(initRecordTemplates);
  const [noteTemplates, setNoteTemplates] = useState<Template[]>(initNoteTemplates);
  const [riskTemplates, setRiskTemplates] = useState<Template[]>(initRiskTemplates);

  // Notification settings
  const [nonUrgentInterval, setNonUrgentInterval] = useState("Every 4 hours");
  const [urgentInterval, setUrgentInterval] = useState("Immediately");
  const [outOfHoursFrom, setOutOfHoursFrom] = useState("20:00");
  const [outOfHoursTo, setOutOfHoursTo] = useState("07:00");
  const [outOfHoursEmail, setOutOfHoursEmail] = useState("oncall@college.ac.uk");
  const [notifSaved, setNotifSaved] = useState(false);

  // Dialogs
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [newCat, setNewCat] = useState(false);
  const [editKpi, setEditKpi] = useState<KPI | null>(null);
  const [newKpi, setNewKpi] = useState(false);
  const [editDist, setEditDist] = useState<DistributionList | null>(null);
  const [newDist, setNewDist] = useState(false);
  const [editTpl, setEditTpl] = useState<Template | null>(null);
  const [newTpl, setNewTpl] = useState(false);
  const [tplKind, setTplKind] = useState<"record" | "note" | "risk">("record");

  // Cat form
  const [catForm, setCatForm] = useState<Omit<Category, "id">>({ name: "", colour: COLOURS[0], description: "" });
  const [kpiForm, setKpiForm] = useState<Omit<KPI, "id">>({ name: "", description: "", target: "" });
  const [distForm, setDistForm] = useState<{ name: string; members: string }>({ name: "", members: "" });
  const [tplForm, setTplForm] = useState<Omit<Template, "id">>({ name: "", category: "Wellbeing", urgent: false, visibility: "Notified staff only", description: "" });

  const TABS: { id: AdminTab; icon: React.ReactNode; label: string }[] = [
    { id: "categories", icon: <Tag size={13} />, label: "Categories" },
    { id: "kpis", icon: <Target size={13} />, label: "KPIs" },
    { id: "distribution", icon: <Users size={13} />, label: "Distribution Lists" },
    { id: "record-templates", icon: <FileText size={13} />, label: "Record Templates" },
    { id: "note-templates", icon: <StickyNote size={13} />, label: "Note Templates" },
    { id: "risk-templates", icon: <AlertTriangle size={13} />, label: "Risk Templates" },
    { id: "notifications", icon: <Bell size={13} />, label: "Notifications" },
  ];

  const saveCategory = () => {
    if (editCat) {
      setCategories((prev) => prev.map((c) => c.id === editCat.id ? { ...c, ...catForm } : c));
      setEditCat(null);
    } else {
      setCategories((prev) => [...prev, { id: Date.now(), ...catForm }]);
      setNewCat(false);
    }
    setCatForm({ name: "", colour: COLOURS[0], description: "" });
  };

  const saveKpi = () => {
    if (editKpi) {
      setKPIs((prev) => prev.map((k) => k.id === editKpi.id ? { ...k, ...kpiForm } : k));
      setEditKpi(null);
    } else {
      setKPIs((prev) => [...prev, { id: Date.now(), ...kpiForm }]);
      setNewKpi(false);
    }
    setKpiForm({ name: "", description: "", target: "" });
  };

  const saveDist = () => {
    const members = distForm.members.split(",").map((m) => m.trim()).filter(Boolean);
    if (editDist) {
      setDistLists((prev) => prev.map((d) => d.id === editDist.id ? { ...d, name: distForm.name, members } : d));
      setEditDist(null);
    } else {
      setDistLists((prev) => [...prev, { id: Date.now(), name: distForm.name, members }]);
      setNewDist(false);
    }
    setDistForm({ name: "", members: "" });
  };

  const saveTpl = (setter: React.Dispatch<React.SetStateAction<Template[]>>) => {
    if (editTpl) {
      setter((prev) => prev.map((t) => t.id === editTpl.id ? { ...t, ...tplForm } : t));
      setEditTpl(null);
    } else {
      setter((prev) => [...prev, { id: Date.now(), ...tplForm }]);
      setNewTpl(false);
    }
    setTplForm({ name: "", category: "Wellbeing", urgent: false, visibility: "Notified staff only", description: "" });
  };

  const openEditCat = (c: Category) => { setEditCat(c); setCatForm({ name: c.name, colour: c.colour, description: c.description }); };
  const openEditKpi = (k: KPI) => { setEditKpi(k); setKpiForm({ name: k.name, description: k.description, target: k.target }); };
  const openEditDist = (d: DistributionList) => { setEditDist(d); setDistForm({ name: d.name, members: d.members.join(", ") }); };
  const openEditTpl = (t: Template, kind: "record" | "note" | "risk") => {
    setEditTpl(t); setTplKind(kind);
    setTplForm({ name: t.name, category: t.category, urgent: t.urgent, visibility: t.visibility, description: t.description });
    setNewTpl(false);
  };

  const TplList = ({ templates, setter, kind }: { templates: Template[]; setter: React.Dispatch<React.SetStateAction<Template[]>>; kind: "record" | "note" | "risk" }) => (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-500">Templates define the fields, urgency, and distribution for new {kind}s.</p>
        <Button size="sm" className="gap-1.5 text-xs h-7 bg-teal-700 hover:bg-teal-800" onClick={() => { setNewTpl(true); setTplKind(kind); setTplForm({ name: "", category: "Wellbeing", urgent: false, visibility: "Notified staff only", description: "" }); setEditTpl(null); }}>
          <Plus size={11} /> New template
        </Button>
      </div>
      {templates.length === 0 ? <p className="text-sm text-gray-400 py-8 text-center border border-dashed border-gray-200 rounded-lg">No {kind} templates yet.</p>
        : (
          <div className="space-y-2">
            {templates.map((t) => (
              <div key={t.id} className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-gray-800">{t.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{t.category}</span>
                    {t.urgent && <span className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded font-semibold">Urgent by default</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Visibility: {t.visibility}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => openEditTpl(t, kind)} className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50"><Pencil size={11} /></button>
                  <button onClick={() => setter((prev) => prev.filter((x) => x.id !== t.id))} className="text-xs px-2 py-1 rounded border border-red-100 text-red-500 hover:bg-red-50"><Trash2 size={11} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );

  const currentTplSetter = tplKind === "record" ? setRecordTemplates : tplKind === "note" ? setNoteTemplates : setRiskTemplates;

  return (
    <div className="-mx-6 -mt-6 min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2 mb-0.5">
          <Shield size={18} className="text-orange-600" />
          <h1 className="text-xl font-bold text-gray-900">Safeguarding Admin</h1>
          <span className="text-[10px] px-2 py-0.5 bg-orange-50 text-orange-700 border border-orange-200 rounded font-medium">Administrator role</span>
        </div>
        <p className="text-sm text-gray-500">
          Set up templates, categories, KPIs, distribution lists, and notification settings. Admins can view and create protected notes from the main Safeguarding page.
        </p>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 px-6 flex gap-0 overflow-x-auto">
        {TABS.map(({ id, icon, label }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === id ? "border-teal-700 text-teal-700" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}>
            {icon} {label}
          </button>
        ))}
      </div>

      <div className="flex-1 p-6 max-w-3xl">

        {/* Categories */}
        {activeTab === "categories" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-gray-500">Create and manage categories for records, notes and meetings to track the number and types of incidents.</p>
              <Button size="sm" className="gap-1.5 text-xs h-7 bg-teal-700 hover:bg-teal-800" onClick={() => { setNewCat(true); setCatForm({ name: "", colour: COLOURS[0], description: "" }); setEditCat(null); }}>
                <Plus size={11} /> New category
              </Button>
            </div>
            <div className="space-y-2">
              {categories.map((c) => (
                <div key={c.id} className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.colour }} />
                  <div className="flex-1">
                    <span className="font-semibold text-sm text-gray-800">{c.name}</span>
                    <p className="text-xs text-gray-500">{c.description}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => openEditCat(c)} className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50"><Pencil size={11} /></button>
                    <button onClick={() => setCategories((prev) => prev.filter((x) => x.id !== c.id))} className="text-xs px-2 py-1 rounded border border-red-100 text-red-500 hover:bg-red-50"><Trash2 size={11} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* KPIs */}
        {activeTab === "kpis" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-gray-500">Create and edit Key Performance Indicators applied to notes to share feedback quickly.</p>
              <Button size="sm" className="gap-1.5 text-xs h-7 bg-teal-700 hover:bg-teal-800" onClick={() => { setNewKpi(true); setKpiForm({ name: "", description: "", target: "" }); setEditKpi(null); }}>
                <Plus size={11} /> New KPI
              </Button>
            </div>
            <div className="space-y-2">
              {kpis.map((k) => (
                <div key={k.id} className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-3">
                  <div className="flex-1">
                    <span className="font-semibold text-sm text-gray-800">{k.name}</span>
                    <p className="text-xs text-gray-500">{k.description}</p>
                    <p className="text-xs text-teal-700 font-medium mt-0.5">Target: {k.target}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => openEditKpi(k)} className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50"><Pencil size={11} /></button>
                    <button onClick={() => setKPIs((prev) => prev.filter((x) => x.id !== k.id))} className="text-xs px-2 py-1 rounded border border-red-100 text-red-500 hover:bg-red-50"><Trash2 size={11} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Distribution Lists */}
        {activeTab === "distribution" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-gray-500">Create recipient groups to make it easy for tutors to share reports with the right people.</p>
              <Button size="sm" className="gap-1.5 text-xs h-7 bg-teal-700 hover:bg-teal-800" onClick={() => { setNewDist(true); setDistForm({ name: "", members: "" }); setEditDist(null); }}>
                <Plus size={11} /> New list
              </Button>
            </div>
            <div className="space-y-2">
              {distLists.map((d) => (
                <div key={d.id} className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-start gap-3">
                  <Users size={14} className="text-gray-400 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <span className="font-semibold text-sm text-gray-800">{d.name}</span>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {d.members.map((m) => (
                        <span key={m} className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{m}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => openEditDist(d)} className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50"><Pencil size={11} /></button>
                    <button onClick={() => setDistLists((prev) => prev.filter((x) => x.id !== d.id))} className="text-xs px-2 py-1 rounded border border-red-100 text-red-500 hover:bg-red-50"><Trash2 size={11} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "record-templates" && <TplList templates={recordTemplates} setter={setRecordTemplates} kind="record" />}
        {activeTab === "note-templates" && <TplList templates={noteTemplates} setter={setNoteTemplates} kind="note" />}
        {activeTab === "risk-templates" && <TplList templates={riskTemplates} setter={setRiskTemplates} kind="risk" />}

        {/* Notifications */}
        {activeTab === "notifications" && (
          <div className="space-y-6">
            <p className="text-xs text-gray-500">Control when safeguarding messages are sent out. Configure intervals for non-urgent, urgent, and out-of-hours notifications.</p>

            <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2"><Bell size={14} /> Delivery intervals</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Non-urgent messages</label>
                  <Select value={nonUrgentInterval} onValueChange={setNonUrgentInterval}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{NOTIFY_INTERVALS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                  </Select>
                  <p className="text-[10px] text-gray-400 mt-1">Messages bundled and sent at this interval.</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Urgent messages</label>
                  <Select value={urgentInterval} onValueChange={setUrgentInterval}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{NOTIFY_INTERVALS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                  </Select>
                  <p className="text-[10px] text-gray-400 mt-1">Urgent messages may be delivered at any time of day.</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2"><Clock size={14} /> Out-of-hours settings</h3>
              <p className="text-xs text-gray-500">Messages sent during out-of-hours indicate a high level of risk and should be treated differently. They are sent to a separate email address in addition to normal notifications.</p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Out-of-hours from</label>
                  <Input type="time" value={outOfHoursFrom} onChange={(e) => setOutOfHoursFrom(e.target.value)} className="text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Out-of-hours to</label>
                  <Input type="time" value={outOfHoursTo} onChange={(e) => setOutOfHoursTo(e.target.value)} className="text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Out-of-hours email address</label>
                <Input value={outOfHoursEmail} onChange={(e) => setOutOfHoursEmail(e.target.value)} className="text-sm max-w-xs" placeholder="oncall@college.ac.uk" />
                <p className="text-[10px] text-gray-400 mt-1">This is in addition to normal notifications for each note or record.</p>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2"><Settings size={14} /> Visibility defaults</h3>
              <p className="text-xs text-gray-500 mb-1">These defaults can be overridden per template. Safeguarding Managers can always view all records regardless of visibility setting.</p>
              <div className="text-xs space-y-2 text-gray-600">
                <div className="flex items-start gap-2 p-2.5 bg-slate-50 rounded border border-slate-200">
                  <span className="font-semibold text-gray-700 w-36 shrink-0">Notified staff only</span> Only staff who are sent a notification can view the risk.
                </div>
                <div className="flex items-start gap-2 p-2.5 bg-slate-50 rounded border border-slate-200">
                  <span className="font-semibold text-gray-700 w-36 shrink-0">All staff</span> All staff with Safeguarding Tutor role can view — even if not notified.
                </div>
                <div className="flex items-start gap-2 p-2.5 bg-slate-50 rounded border border-slate-200">
                  <span className="font-semibold text-gray-700 w-36 shrink-0">Specified list</span> A distribution list is added to allow more staff to view without being notified.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button className="bg-teal-700 hover:bg-teal-800 gap-1.5" onClick={() => { setNotifSaved(true); setTimeout(() => setNotifSaved(false), 2000); }}>
                <Check size={13} /> Save settings
              </Button>
              {notifSaved && <span className="text-sm text-green-700 font-semibold flex items-center gap-1"><Check size={13} /> Saved</span>}
            </div>
          </div>
        )}
      </div>

      {/* Category dialog */}
      <Dialog open={newCat || !!editCat} onOpenChange={() => { setNewCat(false); setEditCat(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editCat ? "Edit Category" : "New Category"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-xs font-semibold text-gray-600 block mb-1">Name <span className="text-red-500">*</span></label>
              <Input value={catForm.name} onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))} className="text-sm" /></div>
            <div><label className="text-xs font-semibold text-gray-600 block mb-1">Colour</label>
              <div className="flex gap-2 flex-wrap">
                {COLOURS.map((c) => (
                  <button key={c} onClick={() => setCatForm((f) => ({ ...f, colour: c }))}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${catForm.colour === c ? "border-gray-800 scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div><label className="text-xs font-semibold text-gray-600 block mb-1">Description</label>
              <Input value={catForm.description} onChange={(e) => setCatForm((f) => ({ ...f, description: e.target.value }))} className="text-sm" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setNewCat(false); setEditCat(null); }}>Cancel</Button>
            <Button className="bg-teal-700 hover:bg-teal-800" disabled={!catForm.name} onClick={saveCategory}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* KPI dialog */}
      <Dialog open={newKpi || !!editKpi} onOpenChange={() => { setNewKpi(false); setEditKpi(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editKpi ? "Edit KPI" : "New KPI"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-xs font-semibold text-gray-600 block mb-1">Name <span className="text-red-500">*</span></label>
              <Input value={kpiForm.name} onChange={(e) => setKpiForm((f) => ({ ...f, name: e.target.value }))} className="text-sm" /></div>
            <div><label className="text-xs font-semibold text-gray-600 block mb-1">Description</label>
              <Input value={kpiForm.description} onChange={(e) => setKpiForm((f) => ({ ...f, description: e.target.value }))} className="text-sm" /></div>
            <div><label className="text-xs font-semibold text-gray-600 block mb-1">Target</label>
              <Input value={kpiForm.target} onChange={(e) => setKpiForm((f) => ({ ...f, target: e.target.value }))} placeholder="e.g. 80%, within 24 hours" className="text-sm" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setNewKpi(false); setEditKpi(null); }}>Cancel</Button>
            <Button className="bg-teal-700 hover:bg-teal-800" disabled={!kpiForm.name} onClick={saveKpi}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Distribution list dialog */}
      <Dialog open={newDist || !!editDist} onOpenChange={() => { setNewDist(false); setEditDist(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editDist ? "Edit Distribution List" : "New Distribution List"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-xs font-semibold text-gray-600 block mb-1">List name <span className="text-red-500">*</span></label>
              <Input value={distForm.name} onChange={(e) => setDistForm((f) => ({ ...f, name: e.target.value }))} className="text-sm" /></div>
            <div><label className="text-xs font-semibold text-gray-600 block mb-1">Members <span className="text-gray-400 font-normal">(comma-separated)</span></label>
              <textarea value={distForm.members} onChange={(e) => setDistForm((f) => ({ ...f, members: e.target.value }))} rows={3}
                placeholder="Head of Year, SENCO, Student Services…"
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setNewDist(false); setEditDist(null); }}>Cancel</Button>
            <Button className="bg-teal-700 hover:bg-teal-800" disabled={!distForm.name} onClick={saveDist}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template dialog */}
      <Dialog open={newTpl || !!editTpl} onOpenChange={() => { setNewTpl(false); setEditTpl(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editTpl ? "Edit Template" : `New ${tplKind} template`}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-xs font-semibold text-gray-600 block mb-1">Name <span className="text-red-500">*</span></label>
              <Input value={tplForm.name} onChange={(e) => setTplForm((f) => ({ ...f, name: e.target.value }))} className="text-sm" /></div>
            <div><label className="text-xs font-semibold text-gray-600 block mb-1">Category</label>
              <Select value={tplForm.category} onValueChange={(v) => setTplForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{["Wellbeing", "Behaviour", "Disclosure", "Attendance Concern", "Mental Health", "Financial Hardship", "Incident"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select></div>
            <div><label className="text-xs font-semibold text-gray-600 block mb-1">Visibility</label>
              <Select value={tplForm.visibility} onValueChange={(v) => setTplForm((f) => ({ ...f, visibility: v }))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{VISIBILITY_OPTIONS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select></div>
            <div><label className="text-xs font-semibold text-gray-600 block mb-1">Description</label>
              <Input value={tplForm.description} onChange={(e) => setTplForm((f) => ({ ...f, description: e.target.value }))} className="text-sm" /></div>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={tplForm.urgent} onChange={(e) => setTplForm((f) => ({ ...f, urgent: e.target.checked }))} className="rounded accent-red-500" />
              Urgent by default
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setNewTpl(false); setEditTpl(null); }}>Cancel</Button>
            <Button className="bg-teal-700 hover:bg-teal-800" disabled={!tplForm.name} onClick={() => saveTpl(currentTplSetter)}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
