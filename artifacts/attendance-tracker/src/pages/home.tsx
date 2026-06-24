import { useGetDashboardSummary, useGetTodaySchedule, useListTargets, useListCourses } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Calendar, Target, BookOpen, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

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
  const { data: summary, isLoading: isSummaryLoading } = useGetDashboardSummary();
  const { data: schedule, isLoading: isScheduleLoading } = useGetTodaySchedule();
  const { data: targets, isLoading: isTargetsLoading } = useListTargets({ overdue: true });
  const { data: courses, isLoading: isCoursesLoading } = useListCourses();

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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase">First Name</label>
                  <Input placeholder="Enter first name" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Last Name</label>
                  <Input placeholder="Enter last name" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase">ID / Person Code</label>
                  <Input placeholder="e.g. 12345" />
                </div>
                <Button className="w-full gap-2">
                  <Search className="w-4 h-4" /> Search Learners
                </Button>
              </div>
            </TabsContent>
            {/* Other tab contents would go here, kept simple for brevity */}
            {['course', 'register', 'exam', 'room', 'staff'].map(tab => (
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
