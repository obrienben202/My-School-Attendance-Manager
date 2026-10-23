import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import {
  useCreateConciergeEnrolment,
  useGetConciergeApplication,
  useListCourses,
  useListStudents,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, CheckCircle, ChevronRight } from "lucide-react";

const STEPS = [
  "Personal Details",
  "Further Details",
  "Learning Objective",
  "Statements",
  "Evidence",
  "Data Protection",
  "Payments",
] as const;

type Step = (typeof STEPS)[number];

type FormData = {
  // Personal
  forename: string;
  surname: string;
  dateOfBirth: string;
  gender: string;
  address1: string;
  address2: string;
  city: string;
  postcode: string;
  phone: string;
  email: string;
  courseId: string;
  // Further
  ethnicity: string;
  disability: string;
  householdSituation: string;
  supportNeeds: string;
  employmentStatus: string;
  // Learning
  learningPurpose: string;
  learningOutcome: string;
  // Statements
  universalCredit: boolean;
  jobseekers: boolean;
  incomeSupport: boolean;
  // Evidence
  evidenceType: string;
  evidenceNotes: string;
  // Data protection
  dataConsent: boolean;
  marketingConsent: boolean;
  // Payments
  courseFee: string;
  paymentMethod: string;
};

const DEFAULTS: FormData = {
  forename: "", surname: "", dateOfBirth: "", gender: "", address1: "", address2: "",
  city: "", postcode: "", phone: "", email: "", courseId: "",
  ethnicity: "", disability: "No known disability", householdSituation: "", supportNeeds: "", employmentStatus: "",
  learningPurpose: "", learningOutcome: "",
  universalCredit: false, jobseekers: false, incomeSupport: false,
  evidenceType: "", evidenceNotes: "",
  dataConsent: false, marketingConsent: false,
  courseFee: "0.00", paymentMethod: "none",
};

export default function EnrolmentsWizard() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const applicationId = params.get("applicationId");

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(DEFAULTS);
  const [saveError, setSaveError] = useState("");

  const { data: application } = useGetConciergeApplication(
    applicationId ? Number(applicationId) : 0,
    { query: { enabled: !!applicationId } as any }
  );
  const { data: students = [] } = useListStudents({} as any);
  const { data: courses = [] } = useListCourses({} as any);
  const { mutateAsync: createEnrolment, isPending: isSaving } = useCreateConciergeEnrolment();

  const applicant =
    application
      ? students.find((s) => s.id === application.studentId)
      : null;

  useEffect(() => {
    if (!application || form.forename) return;
    setForm((current) => ({
      ...current,
      forename: applicant?.forename ?? application.forename ?? "",
      surname: applicant?.surname ?? application.surname ?? "",
      email: application.email ?? "",
      courseId: application.courseId ? String(application.courseId) : "",
    }));
  }, [applicant, application, form.forename]);

  const set = (field: keyof FormData, value: string | boolean) =>
    setForm((f) => ({ ...f, [field]: value }));

  const stepName = STEPS[step];

  const handleNext = async () => {
    setSaveError("");
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      return;
    }
    if (!form.forename.trim() || !form.surname.trim() || !form.email.trim() || !form.courseId) {
      setSaveError("Add the learner's name, email address, and course before completing the enrolment.");
      setStep(0);
      return;
    }
    try {
      const created = await createEnrolment({
        data: {
          applicationId: applicationId ? Number(applicationId) : undefined,
          studentId: applicant?.id,
          courseId: Number(form.courseId),
          forename: form.forename.trim(),
          surname: form.surname.trim(),
          email: form.email.trim(),
          dateOfBirth: form.dateOfBirth || undefined,
          gender: form.gender || undefined,
          postCode: form.postcode.trim() || undefined,
        },
      });
      setLocation(`/concierge/enrolments/${created.id}`);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "The enrolment could not be saved. Check the details and try again.",
      );
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
    else setLocation(applicationId ? `/concierge/applications/${applicationId}` : "/concierge/enrolments");
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft size={16} className="mr-1" />
          {step === 0 ? "Back" : STEPS[step - 1]}
        </Button>
        <h1 className="text-xl font-bold text-gray-900">New Enrolment</h1>
      </div>

      {/* Step progress */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <button
            key={s}
            onClick={() => i < step && setStep(i)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              i === step
                ? "bg-blue-500 text-white"
                : i < step
                ? "bg-green-100 text-green-700 cursor-pointer"
                : "bg-gray-100 text-gray-400 cursor-default"
            }`}
          >
            {i < step && <CheckCircle size={12} />}
            {i + 1}. {s}
          </button>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">{stepName}</h2>

        {stepName === "Personal Details" && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Forename *"><Input value={form.forename} onChange={(e) => set("forename", e.target.value)} /></Field>
            <Field label="Surname *"><Input value={form.surname} onChange={(e) => set("surname", e.target.value)} /></Field>
            <Field label="Date of Birth *"><Input type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} /></Field>
            <Field label="Gender">
              <Select value={form.gender || "prefer_not"} onValueChange={(v) => set("gender", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Non-binary">Non-binary</SelectItem>
                  <SelectItem value="prefer_not">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Email Address"><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
            <Field label="Phone"><Input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
            <div className="col-span-2">
              <Field label="Course *">
                <Select value={form.courseId} onValueChange={(value) => set("courseId", value)}>
                  <SelectTrigger><SelectValue placeholder="Select a course" /></SelectTrigger>
                  <SelectContent>
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={String(course.id)}>
                        {course.code} — {course.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Address Line 1"><Input value={form.address1} onChange={(e) => set("address1", e.target.value)} /></Field>
            </div>
            <Field label="Address Line 2"><Input value={form.address2} onChange={(e) => set("address2", e.target.value)} /></Field>
            <Field label="City / Town"><Input value={form.city} onChange={(e) => set("city", e.target.value)} /></Field>
            <Field label="Postcode"><Input value={form.postcode} onChange={(e) => set("postcode", e.target.value)} /></Field>
          </div>
        )}

        {stepName === "Further Details" && (
          <div className="space-y-4">
            <Field label="Ethnicity">
              <Select value={form.ethnicity || "prefer_not"} onValueChange={(v) => set("ethnicity", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="White British">White British</SelectItem>
                  <SelectItem value="White Irish">White Irish</SelectItem>
                  <SelectItem value="Asian or Asian British">Asian or Asian British</SelectItem>
                  <SelectItem value="Black or Black British">Black or Black British</SelectItem>
                  <SelectItem value="Mixed">Mixed</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                  <SelectItem value="prefer_not">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Disability / Learning Difficulty">
              <Select value={form.disability} onValueChange={(v) => set("disability", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="No known disability">No known disability</SelectItem>
                  <SelectItem value="Dyslexia">Dyslexia</SelectItem>
                  <SelectItem value="Visual impairment">Visual impairment</SelectItem>
                  <SelectItem value="Hearing impairment">Hearing impairment</SelectItem>
                  <SelectItem value="Physical disability">Physical disability</SelectItem>
                  <SelectItem value="Mental health condition">Mental health condition</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Household Situation">
              <Select value={form.householdSituation || "none"} onValueChange={(v) => set("householdSituation", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not applicable</SelectItem>
                  <SelectItem value="Single parent">Single parent</SelectItem>
                  <SelectItem value="Care leaver">Care leaver</SelectItem>
                  <SelectItem value="Carer">Carer</SelectItem>
                  <SelectItem value="Homeless">Homeless</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Support Needs">
              <Textarea value={form.supportNeeds} onChange={(e) => set("supportNeeds", e.target.value)} rows={2} placeholder="Describe any support needs…" />
            </Field>
            <Field label="Employment Status">
              <Select value={form.employmentStatus || "not_employed"} onValueChange={(v) => set("employmentStatus", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Employed">Employed</SelectItem>
                  <SelectItem value="Self-employed">Self-employed</SelectItem>
                  <SelectItem value="Unemployed">Unemployed</SelectItem>
                  <SelectItem value="not_employed">Not in employment</SelectItem>
                  <SelectItem value="Student">Full-time student</SelectItem>
                  <SelectItem value="Retired">Retired</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        )}

        {stepName === "Learning Objective" && (
          <div className="space-y-4">
            <Field label="Tailored Learning Purpose">
              <Input
                value={form.learningPurpose}
                readOnly
                className="bg-gray-50 text-gray-500 cursor-not-allowed"
                placeholder="Set in special details (read-only)"
              />
            </Field>
            <Field label="Tailored Learning Outcome">
              <Select value={form.learningOutcome || "none"} onValueChange={(v) => set("learningOutcome", v)}>
                <SelectTrigger><SelectValue placeholder="Select outcome…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  <SelectItem value="01">01 — Achieve or improve a foundation qualification</SelectItem>
                  <SelectItem value="04">04 — Progression to HE</SelectItem>
                  <SelectItem value="05">05 — Progression to FE</SelectItem>
                  <SelectItem value="06">06 — Progression to employment</SelectItem>
                  <SelectItem value="07">07 — Develop own teaching practice</SelectItem>
                  <SelectItem value="09">09 — Personal development and progression</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        )}

        {stepName === "Statements" && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 mb-4">
              Select any statements that apply to this learner. These determine eligibility for fee concessions.
            </p>
            {[
              { key: "universalCredit" as const, label: "In receipt of Universal Credit" },
              { key: "jobseekers" as const, label: "In receipt of Jobseeker's Allowance" },
              { key: "incomeSupport" as const, label: "In receipt of Income Support" },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 p-3 border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={(e) => set(key, e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
        )}

        {stepName === "Evidence" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Record any evidence required for this enrolment (e.g. valid visa, benefits statements).</p>
            <Field label="Evidence Type">
              <Select value={form.evidenceType || "none"} onValueChange={(v) => set("evidenceType", v)}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None required</SelectItem>
                  <SelectItem value="Passport">Passport</SelectItem>
                  <SelectItem value="Visa">Valid Visa</SelectItem>
                  <SelectItem value="Benefits Statement">Benefits Statement</SelectItem>
                  <SelectItem value="Birth Certificate">Birth Certificate</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Notes">
              <Textarea value={form.evidenceNotes} onChange={(e) => set("evidenceNotes", e.target.value)} rows={3} placeholder="Evidence details or reference number…" />
            </Field>
          </div>
        )}

        {stepName === "Data Protection" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Confirm the learner's consent for use of their personal data by the institution.
            </p>
            <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={form.dataConsent}
                onChange={(e) => set("dataConsent", e.target.checked)}
                className="w-4 h-4 mt-0.5"
              />
              <div>
                <div className="text-sm font-medium">I consent to my personal data being used by the institution</div>
                <div className="text-xs text-gray-500 mt-0.5">Required to process your enrolment. Data is held securely and not shared with third parties without consent.</div>
              </div>
            </label>
            <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={form.marketingConsent}
                onChange={(e) => set("marketingConsent", e.target.checked)}
                className="w-4 h-4 mt-0.5"
              />
              <div>
                <div className="text-sm font-medium">I consent to receive marketing communications (optional)</div>
                <div className="text-xs text-gray-500 mt-0.5">Includes newsletters, course updates, and open day invitations. You can unsubscribe at any time.</div>
              </div>
            </label>
          </div>
        )}

        {stepName === "Payments" && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Course fee</span>
                <span className="font-medium">£{form.courseFee}</span>
              </div>
              {(form.universalCredit || form.jobseekers || form.incomeSupport) && (
                <div className="flex justify-between text-sm text-green-600 mb-2">
                  <span>Concession (benefit entitlement)</span>
                  <span>−£{form.courseFee}</span>
                </div>
              )}
              <div className="border-t border-gray-200 pt-2 flex justify-between font-semibold">
                <span>Total due</span>
                <span>
                  £{(form.universalCredit || form.jobseekers || form.incomeSupport) ? "0.00" : form.courseFee}
                </span>
              </div>
            </div>

            {!(form.universalCredit || form.jobseekers || form.incomeSupport) &&
              parseFloat(form.courseFee) > 0 && (
                <div>
                  <Label>Payment Method</Label>
                  <Select value={form.paymentMethod} onValueChange={(v) => set("paymentMethod", v)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="moto">MOTO (Mail Order / Telephone Order)</SelectItem>
                      <SelectItem value="learner_hub">Learner to pay via Learner Hub</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.paymentMethod === "moto" && (
                    <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
                      <strong>Important:</strong> Use MOTO payments only when the learner's card is not physically present (e.g. during a phone transaction). Do not use for face-to-face payments.
                    </div>
                  )}
                </div>
              )}

            {(form.universalCredit || form.jobseekers || form.incomeSupport) && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
                Total cost is £0.00 based on concession entitlement. You can confirm and complete the enrolment.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      {saveError && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {saveError}
        </div>
      )}
      <div className="flex justify-between mt-4">
        <Button variant="outline" onClick={handleBack}>
          {step === 0 ? "Cancel" : "Back"}
        </Button>
        <Button
          onClick={handleNext}
          disabled={isSaving || (stepName === "Data Protection" && !form.dataConsent)}
        >
          {isSaving ? "Saving Enrolment…" : step === STEPS.length - 1 ? "Confirm & Complete Enrolment" : "Next"}
          {step < STEPS.length - 1 && <ChevronRight size={16} className="ml-1" />}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-sm text-gray-700 mb-1">{label}</Label>
      {children}
    </div>
  );
}
