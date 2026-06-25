import { useState } from "react";
import { useListCourses, useListAttendanceRecords, useListStudents, useUpdateAttendanceRecord, getListAttendanceRecordsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardList } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Attendance() {
  const [courseId, setCourseId] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const { data: courses } = useListCourses();
  
  const { data: records, isLoading: isRecordsLoading } = useListAttendanceRecords(
    { courseId: courseId ? parseInt(courseId) : undefined, date }, 
    { query: { enabled: !!courseId && !!date } as any }
  );

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateRecord = useUpdateAttendanceRecord();

  const handleMark = (id: number, status: "present" | "absent" | "late" | "authorised") => {
    updateRecord.mutate(
      { id, data: { status } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAttendanceRecordsQueryKey() });
          toast({ title: "Register updated", description: "Attendance mark saved." });
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Registers</h1>
          <p className="text-muted-foreground text-sm mt-1">Mark attendance for your courses.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="py-4 border-b bg-slate-50/50">
          <div className="flex gap-4">
            <div className="w-64 space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Course</label>
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent>
                  {courses?.map(c => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name} ({c.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48 space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Date</label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!courseId ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
              <ClipboardList className="w-12 h-12 mb-4 opacity-20" />
              <p>Select a course to view and mark the register.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Mark</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isRecordsLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : records?.length ? (
                  records.map(record => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.studentName}</TableCell>
                      <TableCell>
                        <span className={`font-semibold capitalize ${
                          record.status === 'present' ? 'text-emerald-600' :
                          record.status === 'absent' ? 'text-red-600' :
                          record.status === 'late' ? 'text-amber-600' : 'text-blue-600'
                        }`}>
                          {record.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant={record.status === 'present' ? 'default' : 'outline'} 
                            size="sm" 
                            className={record.status === 'present' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                            onClick={() => handleMark(record.id, "present")}
                          >
                            Present
                          </Button>
                          <Button 
                            variant={record.status === 'late' ? 'default' : 'outline'} 
                            size="sm"
                            className={record.status === 'late' ? 'bg-amber-500 hover:bg-amber-600' : ''}
                            onClick={() => handleMark(record.id, "late")}
                          >
                            Late
                          </Button>
                          <Button 
                            variant={record.status === 'absent' ? 'default' : 'outline'} 
                            size="sm"
                            className={record.status === 'absent' ? 'bg-red-600 hover:bg-red-700' : ''}
                            onClick={() => handleMark(record.id, "absent")}
                          >
                            Absent
                          </Button>
                          <Button 
                            variant={record.status === 'authorised' ? 'default' : 'outline'} 
                            size="sm"
                            className={record.status === 'authorised' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                            onClick={() => handleMark(record.id, "authorised")}
                          >
                            Auth
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                      No learners enrolled in this course for this date.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
