import { useParams } from "wouter";
import { 
  useGetStudent, 
  useListAttendanceRecords, 
  useListTargets, 
  useListIlps 
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, UserCircle, Target, FileText, ClipboardList } from "lucide-react";

export default function StudentDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);

  const { data: student, isLoading: isStudentLoading } = useGetStudent(id, { query: { enabled: !!id } });
  const { data: attendance, isLoading: isAttendanceLoading } = useListAttendanceRecords({ studentId: id }, { query: { enabled: !!id } });
  const { data: targets, isLoading: isTargetsLoading } = useListTargets({ studentId: id }, { query: { enabled: !!id } });
  const { data: ilps, isLoading: isIlpsLoading } = useListIlps({ studentId: id }, { query: { enabled: !!id } });

  if (isStudentLoading) {
    return <div className="space-y-6"><Skeleton className="h-32 w-full" /><Skeleton className="h-96 w-full" /></div>;
  }

  if (!student) {
    return <div className="p-12 text-center text-muted-foreground">Learner not found.</div>;
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="bg-slate-900 h-24 w-full" />
        <CardContent className="p-6 pt-0 relative">
          <div className="flex justify-between items-start">
            <div className="flex gap-6 items-end -mt-12">
              <div className="w-24 h-24 rounded-lg bg-white border-4 border-white shadow-sm flex items-center justify-center text-slate-300">
                <UserCircle className="w-20 h-20" />
              </div>
              <div className="pb-2 space-y-1">
                <h1 className="text-2xl font-bold tracking-tight">{student.forename} {student.middleNames} {student.surname}</h1>
                <div className="flex gap-3 text-sm font-medium text-muted-foreground">
                  <span className="font-mono">{student.personCode}</span>
                  <span>•</span>
                  <span>Year {student.yearGroup}</span>
                  <span>•</span>
                  <span>{student.gender}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              {student.atRisk && (
                <Badge variant="destructive" className="gap-1 shadow-sm">
                  <AlertCircle className="w-3 h-3" /> At Risk
                </Badge>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-6 mt-8 p-4 bg-slate-50 rounded-lg border border-slate-100">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Attendance</p>
              <p className={`text-2xl font-bold mt-1 ${student.attendancePercent < 90 ? 'text-red-600' : 'text-emerald-600'}`}>
                {student.attendancePercent}%
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Punctuality</p>
              <p className={`text-2xl font-bold mt-1 ${student.punctualityPercent < 95 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {student.punctualityPercent}%
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Date of Birth</p>
              <p className="text-lg font-medium mt-1 text-slate-800">{student.dateOfBirth || "Unknown"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Postcode</p>
              <p className="text-lg font-medium mt-1 text-slate-800">{student.postCode || "Unknown"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="attendance" className="w-full">
        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent mb-6">
          <TabsTrigger value="attendance" className="px-6 py-3 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary shadow-none data-[state=active]:shadow-none bg-transparent">
            Attendance History
          </TabsTrigger>
          <TabsTrigger value="targets" className="px-6 py-3 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary shadow-none data-[state=active]:shadow-none bg-transparent">
            SMART Targets
          </TabsTrigger>
          <TabsTrigger value="ilp" className="px-6 py-3 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary shadow-none data-[state=active]:shadow-none bg-transparent">
            ILPs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="mt-0 outline-none">
          <Card>
            <CardHeader className="py-4 border-b flex flex-row items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">Recent Registers</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
               {isAttendanceLoading ? (
                 <div className="p-8 text-center"><Skeleton className="h-8 w-full max-w-md mx-auto" /></div>
               ) : attendance?.length ? (
                 <ul className="divide-y">
                   {attendance.map(record => (
                     <li key={record.id} className="p-4 flex items-center justify-between">
                       <div>
                         <p className="font-medium text-sm">{record.courseName}</p>
                         <p className="text-xs text-muted-foreground">{record.date}</p>
                       </div>
                       <Badge variant={record.status === 'present' ? 'default' : record.status === 'absent' ? 'destructive' : 'secondary'} className={record.status === 'present' ? 'bg-emerald-600' : ''}>
                         {record.status}
                       </Badge>
                     </li>
                   ))}
                 </ul>
               ) : (
                 <div className="p-8 text-center text-muted-foreground">No attendance records.</div>
               )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="targets" className="mt-0 outline-none">
          <Card>
            <CardHeader className="py-4 border-b flex flex-row items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">Targets</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
               {isTargetsLoading ? (
                 <div className="p-8 text-center"><Skeleton className="h-8 w-full max-w-md mx-auto" /></div>
               ) : targets?.length ? (
                 <ul className="divide-y">
                   {targets.map(target => (
                     <li key={target.id} className="p-4 flex flex-col gap-1">
                       <div className="flex justify-between items-start">
                         <p className="font-medium text-sm">{target.title}</p>
                         <Badge variant={target.completed ? "secondary" : target.overdue ? "destructive" : "outline"}>
                           {target.completed ? "Completed" : target.overdue ? "Overdue" : "Active"}
                         </Badge>
                       </div>
                       <p className="text-xs text-muted-foreground line-clamp-2">{target.description}</p>
                       <p className="text-[10px] font-medium text-muted-foreground mt-1">Due: {target.dueDate}</p>
                     </li>
                   ))}
                 </ul>
               ) : (
                 <div className="p-8 text-center text-muted-foreground">No SMART targets set.</div>
               )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ilp" className="mt-0 outline-none">
          <Card>
            <CardHeader className="py-4 border-b flex flex-row items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">Individual Learning Plans</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
               {isIlpsLoading ? (
                 <div className="p-8 text-center"><Skeleton className="h-8 w-full max-w-md mx-auto" /></div>
               ) : ilps?.length ? (
                 <ul className="divide-y">
                   {ilps.map(ilp => (
                     <li key={ilp.id} className="p-4 flex items-center justify-between">
                       <div>
                         <p className="font-medium text-sm">{ilp.title}</p>
                         <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{ilp.content}</p>
                       </div>
                       <Badge variant="outline" className="capitalize">
                         {ilp.status}
                       </Badge>
                     </li>
                   ))}
                 </ul>
               ) : (
                 <div className="p-8 text-center text-muted-foreground">No ILPs created.</div>
               )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
