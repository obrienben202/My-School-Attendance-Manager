import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, BookOpen, Users, DollarSign, Camera, FileText, CheckCircle } from "lucide-react";

const TABS = ["Overview", "Manage Children", "Fees & Waivers", "Learner Photo", "Learning Agreement"] as const;
type Tab = (typeof TABS)[number];

// Mock enrolment data (in a real app this would come from the API)
const MOCK = {
  id: 1,
  learner: "Emma Davies",
  course: "A-Level Mathematics",
  courseCode: "AMAT01",
  startDate: "2026-09-01",
  endDate: "2027-06-30",
  progressCode: "A",
  status: "Enrolled",
  children: [
    { id: 2, code: "MATH-S1", name: "Maths Support Session", status: "Enrolled", type: "Child" },
    { id: 3, code: "ENG-B", name: "English Functional Skills", status: "Enrolled", type: "Mandatory Child" },
  ],
  fees: [
    { description: "Course Fee", amount: 0.00, paid: 0.00, waiver: "Full Concession" },
  ],
};

const PROGRESS_CODES = ["A", "B", "C", "D", "E", "F", "L", "P", "Q", "R", "T", "U", "W", "X", "Y", "Z"];

export default function EnrolmentOverview() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [progressCode, setProgressCode] = useState(MOCK.progressCode);
  const [photoUploaded, setPhotoUploaded] = useState(false);
  const [agreementSent, setAgreementSent] = useState(false);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/concierge/enrolments")}>
          <ArrowLeft size={16} className="mr-1" /> Enrolments
        </Button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{MOCK.learner}</h1>
          <p className="text-sm text-gray-500">{MOCK.courseCode} — {MOCK.course}</p>
        </div>
        <span className="ml-auto px-2 py-0.5 text-xs rounded-full font-medium bg-green-100 text-green-700">
          {MOCK.status}
        </span>
      </div>

      {/* Quick info strip */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: "Start Date", value: new Date(MOCK.startDate).toLocaleDateString("en-GB") },
          { label: "End Date", value: new Date(MOCK.endDate).toLocaleDateString("en-GB") },
          { label: "Progress Code", value: progressCode },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-lg p-3 text-sm">
            <div className="text-xs text-gray-400 mb-0.5">{label}</div>
            <div className="font-semibold text-gray-900">{value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {TABS.map((tab) => {
            const iconMap: Record<Tab, React.ReactNode> = {
              Overview: <BookOpen size={14} />,
              "Manage Children": <Users size={14} />,
              "Fees & Waivers": <DollarSign size={14} />,
              "Learner Photo": <Camera size={14} />,
              "Learning Agreement": <FileText size={14} />,
            };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-blue-500 text-blue-600 bg-blue-50"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {iconMap[tab]}
                {tab}
              </button>
            );
          })}
        </div>

        <div className="p-5">
          {/* Overview */}
          {activeTab === "Overview" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Update Progress Code</h3>
                <p className="text-xs text-gray-500 mb-2">
                  Changing the progress code applies automatically to all linked child enrolments.
                </p>
                <div className="flex items-center gap-3 max-w-sm">
                  <Select value={progressCode} onValueChange={setProgressCode}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROGRESS_CODES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm">Update</Button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Enrolments</h3>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>Code</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-mono text-sm">{MOCK.courseCode}</TableCell>
                      <TableCell className="font-medium">{MOCK.course}</TableCell>
                      <TableCell><span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Parent</span></TableCell>
                      <TableCell><span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{progressCode}</span></TableCell>
                    </TableRow>
                    {MOCK.children.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-sm pl-8">{c.code}</TableCell>
                        <TableCell className="text-gray-600">{c.name}</TableCell>
                        <TableCell><span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{c.type}</span></TableCell>
                        <TableCell><span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{progressCode}</span></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Manage Children */}
          {activeTab === "Manage Children" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">Child Courses</h3>
                <Button size="sm" variant="outline">+ Attach Child Course</Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Code</TableHead>
                    <TableHead>Course Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MOCK.children.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-sm">{c.code}</TableCell>
                      <TableCell>{c.name}</TableCell>
                      <TableCell><span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{c.type}</span></TableCell>
                      <TableCell><span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{c.status}</span></TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 h-7 text-xs">
                          Detach
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">Elective Courses</h3>
                  <Button size="sm" variant="outline">+ Add Elective</Button>
                </div>
                <div className="p-4 text-center text-gray-400 text-sm border border-dashed border-gray-200 rounded-md">
                  No elective courses added yet
                </div>
              </div>
            </div>
          )}

          {/* Fees & Waivers */}
          {activeTab === "Fees & Waivers" && (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Waiver</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MOCK.fees.map((fee, i) => (
                    <TableRow key={i}>
                      <TableCell>{fee.description}</TableCell>
                      <TableCell>£{fee.amount.toFixed(2)}</TableCell>
                      <TableCell>£{fee.paid.toFixed(2)}</TableCell>
                      <TableCell>£{(fee.amount - fee.paid).toFixed(2)}</TableCell>
                      <TableCell>
                        {fee.waiver ? (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{fee.waiver}</span>
                        ) : (
                          <Button size="sm" variant="outline" className="h-6 text-xs">Apply Waiver</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold bg-gray-50">
                    <TableCell>Total</TableCell>
                    <TableCell>£{MOCK.fees.reduce((s, f) => s + f.amount, 0).toFixed(2)}</TableCell>
                    <TableCell>£{MOCK.fees.reduce((s, f) => s + f.paid, 0).toFixed(2)}</TableCell>
                    <TableCell>£{MOCK.fees.reduce((s, f) => s + f.amount - f.paid, 0).toFixed(2)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <Button variant="outline" size="sm">View Receipts</Button>
            </div>
          )}

          {/* Learner Photo */}
          {activeTab === "Learner Photo" && (
            <div className="space-y-4 max-w-sm">
              <div className="w-32 h-40 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center mx-auto">
                {photoUploaded ? (
                  <div className="text-center">
                    <CheckCircle size={32} className="text-green-500 mx-auto mb-1" />
                    <span className="text-xs text-green-600">Photo uploaded</span>
                  </div>
                ) : (
                  <Camera size={32} className="text-gray-300" />
                )}
              </div>
              <div className="flex gap-2 justify-center">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPhotoUploaded(true)}
                >
                  Upload Photo
                </Button>
                <Button size="sm" variant="outline">Capture from Camera</Button>
              </div>
              <p className="text-xs text-gray-400 text-center">
                Accepted formats: JPEG, PNG. Max size: 5MB.
              </p>
            </div>
          )}

          {/* Learning Agreement */}
          {activeTab === "Learning Agreement" && (
            <div className="space-y-4 max-w-lg">
              <p className="text-sm text-gray-600">
                Generate and send the learner's learning agreement for digital review and signature in the Learner Hub.
              </p>
              <div className="p-4 border border-gray-200 rounded-md space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Learner</span>
                  <span className="font-medium">{MOCK.learner}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Course</span>
                  <span className="font-medium">{MOCK.course}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Status</span>
                  <span className={agreementSent ? "text-green-600 font-medium" : "text-gray-400"}>
                    {agreementSent ? "Sent — awaiting signature" : "Not yet sent"}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">Generate PDF</Button>
                <Button
                  size="sm"
                  onClick={() => setAgreementSent(true)}
                  disabled={agreementSent}
                >
                  {agreementSent ? "Agreement Sent" : "Send to Learner Hub"}
                </Button>
              </div>
              {agreementSent && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle size={16} /> The learner will receive a notification to review and sign their agreement.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
