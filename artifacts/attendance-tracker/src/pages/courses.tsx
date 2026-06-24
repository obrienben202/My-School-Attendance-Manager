import { useListCourses } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Users } from "lucide-react";

export default function Courses() {
  const { data: courses, isLoading } = useListCourses();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Courses Directory</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage and view all active courses.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="py-4 border-b bg-slate-50/50 flex flex-row items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          <CardTitle className="text-base">All Courses</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Course Name</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Year Group</TableHead>
                <TableHead>Enrolled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  </TableRow>
                ))
              ) : courses?.length ? (
                courses.map((course) => (
                  <TableRow key={course.id} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="font-mono text-xs font-semibold">{course.code}</TableCell>
                    <TableCell className="font-medium">{course.name}</TableCell>
                    <TableCell>{course.staffName || "Unassigned"}</TableCell>
                    <TableCell>{course.room || "TBA"}</TableCell>
                    <TableCell>{course.yearGroup || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="gap-1">
                        <Users className="w-3 h-3" />
                        {course.enrolledCount}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No courses found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
