import { useState } from "react";
import { useListStudents } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, AlertCircle } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

export default function Students() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  
  const { data: students, isLoading } = useListStudents({ 
    surname: debouncedSearch || undefined 
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Learner Directory</h1>
          <p className="text-muted-foreground text-sm mt-1">Search and manage all enrolled students.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="py-4 border-b">
          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by surname..." 
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Year Group</TableHead>
                <TableHead>Attendance</TableHead>
                <TableHead>Punctuality</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  </TableRow>
                ))
              ) : students?.length ? (
                students.map((student) => (
                  <TableRow key={student.id} className="hover:bg-slate-50 cursor-pointer transition-colors relative">
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      <Link href={`/students/${student.id}`} className="absolute inset-0" />
                      {student.personCode}
                    </TableCell>
                    <TableCell className="font-medium">
                      {student.surname}, {student.forename}
                    </TableCell>
                    <TableCell>{student.yearGroup}</TableCell>
                    <TableCell>
                      <span className={`font-semibold ${student.attendancePercent < 90 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {student.attendancePercent}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`font-semibold ${student.punctualityPercent < 95 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {student.punctualityPercent}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {student.atRisk && (
                          <Badge variant="destructive" className="gap-1 px-1.5 py-0">
                            <AlertCircle className="w-3 h-3" /> At Risk
                          </Badge>
                        )}
                        {!student.confirmedLearner && (
                          <Badge variant="secondary" className="px-1.5 py-0">Unconfirmed</Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No learners found.
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
