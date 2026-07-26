import { useState } from "react";
import { useRole } from "@/hooks/use-role";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw, Database, Users, BookOpen, ClipboardList, CheckCircle2, AlertCircle, Info } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type SyncSummaryEntry = {
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
};

type SyncResult = {
  ok: boolean;
  error?: string;
  summary?: {
    students: SyncSummaryEntry;
    attendance: SyncSummaryEntry;
    kpis: SyncSummaryEntry;
  };
};

type SyncStatus = {
  counts: { students: number; courses: number; attendance: number };
  kpiBenchmarks: Array<{
    id: number;
    category: string;
    label: string;
    lowerPercent: string;
    upperPercent: string;
  }>;
};

export default function AdminSync() {
  const role = useRole();
  const { toast } = useToast();
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);

  const { data: status, refetch: refetchStatus } = useQuery<SyncStatus>({
    queryKey: ["sync-status"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/admin/sync/status`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load status");
      return r.json();
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${BASE}/api/admin/sync/sheets`, {
        method: "POST",
        credentials: "include",
      });
      return r.json() as Promise<SyncResult>;
    },
    onSuccess: (data) => {
      setLastResult(data);
      refetchStatus();
      if (data.ok) {
        const s = data.summary!;
        toast({
          title: "Sync complete",
          description: `Students: +${s.students.inserted} new, ${s.students.updated} updated · Attendance: +${s.attendance.inserted} records · KPIs: ${s.kpis.inserted} benchmarks`,
        });
      } else {
        toast({ title: "Sync failed", description: data.error, variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Sync error", description: "Could not reach the server.", variant: "destructive" });
    },
  });

  if (role !== "admin" && role !== "hod") {
    return (
      <div className="p-8 text-center text-muted-foreground">
        You don't have permission to view this page.
      </div>
    );
  }

  const attendanceBenchmarks = status?.kpiBenchmarks.filter(b => b.category === "attendance") ?? [];
  const punctualityBenchmarks = status?.kpiBenchmarks.filter(b => b.category === "punctuality") ?? [];

  const labelColour = (label: string) => {
    switch (label.toLowerCase()) {
      case "exceptional": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "good": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "satisfactory": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "unsatisfactory": return "bg-red-500/20 text-red-400 border-red-500/30";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Data Sync</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Import students, attendance records, and KPI benchmarks from Google Sheets.
          </p>
        </div>
        <Button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
          {syncMutation.isPending ? "Syncing…" : "Sync Now"}
        </Button>
      </div>

      {/* Current counts */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Users className="h-8 w-8 text-blue-400" />
            <div>
              <p className="text-2xl font-bold">{status?.counts.students ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Students</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-purple-400" />
            <div>
              <p className="text-2xl font-bold">{status?.counts.courses ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Courses</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <ClipboardList className="h-8 w-8 text-green-400" />
            <div>
              <p className="text-2xl font-bold">{status?.counts.attendance ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Attendance Records</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Last sync result */}
      {lastResult && (
        <Card className={lastResult.ok ? "border-green-500/30" : "border-red-500/30"}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              {lastResult.ok
                ? <CheckCircle2 className="h-4 w-4 text-green-400" />
                : <AlertCircle className="h-4 w-4 text-red-400" />}
              Last Sync Result
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lastResult.ok && lastResult.summary ? (
              <div className="space-y-3">
                {(["students", "attendance", "kpis"] as const).map(key => {
                  const s = lastResult.summary![key];
                  return (
                    <div key={key} className="flex items-start gap-4">
                      <span className="w-24 text-sm font-medium capitalize text-muted-foreground">{key}</span>
                      <div className="flex gap-3 flex-wrap">
                        {s.inserted > 0 && <Badge variant="outline" className="text-green-400 border-green-500/30">+{s.inserted} new</Badge>}
                        {s.updated > 0 && <Badge variant="outline" className="text-blue-400 border-blue-500/30">{s.updated} updated</Badge>}
                        {s.skipped > 0 && <Badge variant="outline" className="text-yellow-400 border-yellow-500/30">{s.skipped} skipped</Badge>}
                        {s.inserted === 0 && s.updated === 0 && s.skipped === 0 && s.errors.length === 0 &&
                          <Badge variant="outline" className="text-muted-foreground">no changes</Badge>}
                        {s.errors.length > 0 && (
                          <span className="text-xs text-red-400">{s.errors[0]}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-red-400">{lastResult.error}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* KPI Benchmarks */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { title: "Attendance Benchmarks", rows: attendanceBenchmarks },
          { title: "Punctuality Benchmarks", rows: punctualityBenchmarks },
        ].map(({ title, rows }) => (
          <Card key={title}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription>Synced from the KPIs sheet</CardDescription>
            </CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Info className="h-4 w-4" />
                  Run a sync to populate benchmarks
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rating</TableHead>
                      <TableHead className="text-right">Range</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map(b => (
                      <TableRow key={b.id}>
                        <TableCell>
                          <Badge variant="outline" className={labelColour(b.label)}>{b.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {b.lowerPercent}% – {b.upperPercent}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info note */}
      <Card className="border-dashed">
        <CardContent className="pt-4">
          <div className="flex gap-3 text-sm text-muted-foreground">
            <Database className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-foreground mb-1">What gets synced</p>
              <ul className="space-y-1 list-disc list-inside">
                <li><strong>Students Roster</strong> — upserts by Student ID; creates/updates name, year group, form group, and course enrollments</li>
                <li><strong>Attendance Log</strong> — imports new records; skips rows where the student or course isn't yet in the system</li>
                <li><strong>KPIs</strong> — replaces all attendance and punctuality benchmarks with the current sheet values</li>
              </ul>
              <p className="mt-2">Share the Courses spreadsheet link and I'll wire that up too.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
