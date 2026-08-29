import { useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import {
  requestUploadUrl,
  useAssociateConciergeEnrolmentPhoto,
  useGetConciergeEnrolment,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Camera,
  CheckCircle,
  DollarSign,
  FileText,
  Users,
} from "lucide-react";
import {
  buildAgreementHandoff,
  enrolmentActionErrorMessage,
  type EnrolmentPhotoType,
  validateEnrolmentPhoto,
} from "@/lib/enrolment-actions";

const TABS = ["Overview", "Manage Children", "Fees & Waivers", "Learner Photo", "Learning Agreement"] as const;
type Tab = (typeof TABS)[number];
type PhotoState = "idle" | "uploading" | "saved" | "error";

function uploadFile(file: File, url: string, onProgress: (value: number) => void) {
  return new Promise<void>((resolve, reject) => {
    if (typeof XMLHttpRequest === "undefined") {
      reject(new Error("This browser cannot upload files. Try a current desktop browser."));
      return;
    }
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", file.type);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(15 + Math.round((event.loaded / event.total) * 75));
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error("The image could not be uploaded to storage."));
    });
    request.addEventListener("error", () => reject(new Error("The upload was interrupted. Check your connection and try again.")));
    request.addEventListener("abort", () => reject(new Error("The upload was cancelled.")));
    request.send(file);
  });
}

export default function EnrolmentOverview() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [photoState, setPhotoState] = useState<PhotoState>("idle");
  const [photoProgress, setPhotoProgress] = useState(0);
  const [photoMessage, setPhotoMessage] = useState("");
  const [agreementMessage, setAgreementMessage] = useState("");
  const [agreementPrepared, setAgreementPrepared] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: enrolment, isLoading, error, refetch } = useGetConciergeEnrolment(id, {
    query: { enabled: Number.isInteger(id) && id > 0 } as any,
  });
  const { mutateAsync: associatePhoto } = useAssociateConciergeEnrolmentPhoto();

  if (isLoading) {
    return <div className="p-6 text-center text-gray-500">Loading enrolment…</div>;
  }
  if (!enrolment || error) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/concierge/enrolments")}>
          <ArrowLeft size={16} className="mr-1" /> Enrolments
        </Button>
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          This enrolment could not be loaded. Return to the enrolment list and try again.
        </div>
      </div>
    );
  }

  const learnerName = `${enrolment.forename} ${enrolment.surname}`.trim();

  const choosePhoto = () => {
    setPhotoMessage("");
    if (!fileInputRef.current || typeof File === "undefined") {
      setPhotoState("error");
      setPhotoMessage("File selection is unavailable in this browser. Try a current desktop browser.");
      return;
    }
    fileInputRef.current.click();
  };

  const handlePhoto = async (file: File | undefined) => {
    if (!file) return;
    const validationError = validateEnrolmentPhoto(file);
    if (validationError) {
      setPhotoState("error");
      setPhotoMessage(validationError);
      return;
    }
    if (
      enrolment.photoObjectPath &&
      !window.confirm("Replace the saved learner photo with this image?")
    ) {
      setPhotoMessage("The existing photo was kept.");
      return;
    }

    setPhotoState("uploading");
    setPhotoProgress(5);
    setPhotoMessage("Preparing secure upload…");
    try {
      const contentType = file.type as EnrolmentPhotoType;
      const upload = await requestUploadUrl({
        enrolmentId: enrolment.id,
        name: file.name,
        size: file.size,
        contentType,
      });
      setPhotoProgress(15);
      setPhotoMessage("Uploading learner photo…");
      await uploadFile(file, upload.uploadURL, setPhotoProgress);
      setPhotoProgress(92);
      setPhotoMessage("Saving photo to this enrolment…");
      await associatePhoto({
        id,
        data: { objectPath: upload.objectPath, contentType },
      });
      await refetch();
      setPhotoProgress(100);
      setPhotoState("saved");
      setPhotoMessage(enrolment.photoObjectPath ? "Replacement photo saved." : "Learner photo saved.");
    } catch (uploadError) {
      setPhotoState("error");
      setPhotoMessage(
        enrolmentActionErrorMessage(
          uploadError,
          uploadError instanceof Error
            ? uploadError.message
            : "The photo could not be saved. Check your connection and try again.",
        ),
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const prepareAgreement = () => {
    setAgreementMessage("");
    setAgreementPrepared(false);
    const handoff = buildAgreementHandoff({
      recipient: enrolment.email,
      learnerName,
      courseName: enrolment.course,
      courseCode: enrolment.courseCode,
    });
    if (!handoff.ok) {
      setAgreementMessage(handoff.error);
      return;
    }
    if (typeof window === "undefined" || !window.location) {
      setAgreementMessage("Email handoff is unavailable in this browser. Copy the learner details into your mail app instead.");
      return;
    }
    try {
      window.location.href = handoff.mailto;
      setAgreementPrepared(true);
      setAgreementMessage("Email prepared in your mail app. Review it there before sending; this system has not delivered it.");
    } catch {
      setAgreementMessage("Your mail app could not be opened. Check the browser's default email-app setting and try again.");
    }
  };

  const icons: Record<Tab, React.ReactNode> = {
    Overview: <BookOpen size={14} />,
    "Manage Children": <Users size={14} />,
    "Fees & Waivers": <DollarSign size={14} />,
    "Learner Photo": <Camera size={14} />,
    "Learning Agreement": <FileText size={14} />,
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/concierge/enrolments")}>
          <ArrowLeft size={16} className="mr-1" /> Enrolments
        </Button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{learnerName}</h1>
          <p className="text-sm text-gray-500">{enrolment.courseCode} — {enrolment.course}</p>
        </div>
        <span className="ml-auto px-2 py-0.5 text-xs rounded-full font-medium bg-green-100 text-green-700">
          Enrolled
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <InfoCard label="Enrolled" value={new Date(enrolment.createdAt).toLocaleDateString("en-GB")} />
        <InfoCard label="Progress Code" value={enrolment.progressCode} />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-blue-500 text-blue-600 bg-blue-50"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {icons[tab]} {tab}
            </button>
          ))}
        </div>

        <div className="p-5">
          {activeTab === "Overview" && (
            <div className="grid grid-cols-2 gap-4 text-sm max-w-xl">
              <InfoRow label="Learner" value={learnerName} />
              <InfoRow label="Course" value={`${enrolment.courseCode} — ${enrolment.course}`} />
              <InfoRow label="Contact email" value={enrolment.email || "Not recorded"} />
              <InfoRow label="Progress code" value={enrolment.progressCode} />
            </div>
          )}

          {activeTab === "Manage Children" && (
            <EmptyState>No linked child or elective courses are recorded for this enrolment.</EmptyState>
          )}

          {activeTab === "Fees & Waivers" && (
            <EmptyState>No fee or waiver records are available for this enrolment.</EmptyState>
          )}

          {activeTab === "Learner Photo" && (
            <div className="space-y-4 max-w-md">
              <div className="w-40 h-48 bg-gray-100 border border-gray-300 rounded-lg flex items-center justify-center mx-auto overflow-hidden">
                {enrolment.photoObjectPath ? (
                  <img
                    src={`/api/storage${enrolment.photoObjectPath}`}
                    alt={`Saved learner photo for ${learnerName}`}
                    className="w-full h-full object-cover"
                    onError={() => {
                      setPhotoState("error");
                      setPhotoMessage("The saved photo could not be loaded. Try replacing it.");
                    }}
                  />
                ) : (
                  <Camera size={36} className="text-gray-300" aria-hidden="true" />
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                className="sr-only"
                onChange={(event) => void handlePhoto(event.target.files?.[0])}
              />
              <div className="flex justify-center">
                <Button size="sm" variant="outline" onClick={choosePhoto} disabled={photoState === "uploading"}>
                  {enrolment.photoObjectPath ? "Replace Photo" : "Upload Photo"}
                </Button>
              </div>
              {photoState === "uploading" && (
                <div className="space-y-1" aria-live="polite">
                  <Progress value={photoProgress} />
                  <p className="text-xs text-gray-600 text-center">{photoMessage} {photoProgress}%</p>
                </div>
              )}
              {photoMessage && photoState !== "uploading" && (
                <StatusMessage error={photoState === "error"} success={photoState === "saved"}>
                  {photoMessage}
                </StatusMessage>
              )}
              {enrolment.photoUpdatedAt && photoState !== "uploading" && (
                <p className="text-xs text-gray-500 text-center">
                  Saved {new Date(enrolment.photoUpdatedAt).toLocaleString("en-GB")}
                </p>
              )}
              <p className="text-xs text-gray-500 text-center">JPEG or PNG, up to 5MB.</p>
            </div>
          )}

          {activeTab === "Learning Agreement" && (
            <div className="space-y-4 max-w-lg">
              <p className="text-sm text-gray-600">
                Prepare a pre-addressed email in your mail app. You remain responsible for reviewing and sending it.
              </p>
              <div className="p-4 border border-gray-200 rounded-md space-y-2">
                <SummaryRow label="Learner" value={learnerName} />
                <SummaryRow label="Course" value={enrolment.course} />
                <SummaryRow label="Recipient" value={enrolment.email || "No email recorded"} />
                <SummaryRow
                  label="Status"
                  value={agreementPrepared ? "Email prepared — not sent" : enrolment.email ? "Ready to prepare" : "Unavailable"}
                  emphasis={agreementPrepared}
                />
              </div>
              <Button size="sm" onClick={prepareAgreement}>Prepare Agreement Email</Button>
              {agreementMessage && (
                <StatusMessage error={!agreementPrepared} success={agreementPrepared}>
                  {agreementMessage}
                </StatusMessage>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 text-sm">
      <div className="text-xs text-gray-400 mb-0.5">{label}</div>
      <div className="font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs text-gray-400 mb-0.5">{label}</div><div className="font-medium text-gray-800">{value}</div></div>;
}

function SummaryRow({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return <div className="flex justify-between gap-4 text-sm"><span className="text-gray-500">{label}</span><span className={emphasis ? "font-medium text-blue-700" : "font-medium text-right"}>{value}</span></div>;
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="p-6 text-center text-gray-500 text-sm border border-dashed border-gray-200 rounded-md">{children}</div>;
}

function StatusMessage({ children, error, success }: { children: React.ReactNode; error?: boolean; success?: boolean }) {
  return (
    <div
      role={error ? "alert" : "status"}
      className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
        error ? "border-red-200 bg-red-50 text-red-700" : success ? "border-green-200 bg-green-50 text-green-700" : "border-blue-200 bg-blue-50 text-blue-700"
      }`}
    >
      {error ? <AlertCircle size={16} className="mt-0.5 shrink-0" /> : <CheckCircle size={16} className="mt-0.5 shrink-0" />}
      <span>{children}</span>
    </div>
  );
}