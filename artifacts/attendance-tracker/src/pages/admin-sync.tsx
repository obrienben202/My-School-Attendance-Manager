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
import {
  RefreshCw,
  Database,
  Users,
  BookOpen,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type SyncSummaryEntry = {
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
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
  lastRanAt: string | null;
  lastSummary: Record<string, SyncSummaryEntry> | null;
  lastError: string | null;
  running: boolean;
};

export default function AdminSync() {
  const role = useRole();
  const { toast } = useToast();

  const { data: status, refetch: refetchStatus, isFetching } = useQuery<SyncStatus>({
    queryKey: ["sync-status"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/admin/sync/status`, { credentials: "include", cache: "no-store" });
      if (!r.ok) throw new Error("Failed to load status");
      return r.json();
    },
    refetchInterval: 60_000, // refresh every minute so the page stays current
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${BASE}/api/admin/sync/sheets`, {
        method: "POST",
        credentials: "include",
      });
      return r.json();
    },
    onSuccess: (data) => {
      refetchStatus();
      if (data.ok) {
        toast({ title: "Sync triggered", description: "Sheets pulled and database updated." });
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
      case "exceptional":    return "bg-green-500/20 text-green-400 border-green-500/30";
      case "good":           return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "satisfactory":   return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "unsatisfactory": return "bg-red-500/20 text-red-400 border-red-500/30";
      default:               return "bg-muted text-muted-foreground";
    }
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return "Never";
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Data Sync</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Automatically syncs from Google Sheets every 15 minutes. Changes in the spreadsheets appear here without anyone needing to do anything.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending || status?.running}
          className="gap-2 shrink-0"
        >
          {syncMutation.isPending || status?.running
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <RefreshCw className="h-4 w-4" />}
          Force sync
        </Button>
      </div>

      {/* Last sync status bar */}
      <Card className={status?.lastError ? "border-red-500/30" : "border-green-500/20"}>
        <CardContent className="py-4 flex items-center gap-4">
          {status?.running ? (
            <Loader2 className="h-5 w-5 text-blue-400 animate-spin shrink-0" />
          ) : status?.lastError ? (
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              {status?.running
                ? "Sync in progress…"
                : status?.lastError
                ? `Last sync failed: ${status.lastError}`
                : "Last sync completed successfully"}
            </p>
            {status?.lastRanAt && !status.running && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Clock className="h-3 w-3" />
                {formatTime(status.lastRanAt)} · next run in ~15 min
              </p>
            )}
            {!status?.lastRanAt && !status?.running && (
              <p className="text-xs text-muted-foreground mt-0.5">
                First sync runs 30 seconds after server starts
              </p>
            )}
          </div>
          {/* Mini summary badges from last run */}
          {status?.lastSummary && !status.running && (
            <div className="flex gap-2 flex-wrap justify-end">
              {(["courses", "students", "attendance", "kpis"] as const).map(key => {
                const s = status.lastSummary![key];
                if (!s) return null;
                const total = s.inserted + s.updated;
                return (
                  <Badge key={key} variant="outline" className="text-xs capitalize">
                    {key}: {total > 0 ? `${total} changes` : "no changes"}
                  </Badge>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current counts */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Users className="h-8 w-8 text-blue-400 shrink-0" />
            <div>
              <p className="text-2xl font-bold">{status?.counts.students ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Students</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-purple-400 shrink-0" />
            <div>
              <p className="text-2xl font-bold">{status?.counts.courses ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Courses</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <ClipboardList className="h-8 w-8 text-green-400 shrink-0" />
            <div>
              <p className="text-2xl font-bold">{status?.counts.attendance ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Attendance Records</p>
            </div>
          </CardContent>
        </Card>
      </div>

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
                <p className="text-sm text-muted-foreground py-4">
                  Waiting for first sync…
                </p>
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

      {/* What syncs */}
      <Card className="border-dashed">
        <CardContent className="pt-4">
          <div className="flex gap-3 text-sm text-muted-foreground">
            <Database className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-foreground mb-1">What gets synced automatically</p>
              <ul className="space-y-1 list-disc list-inside">
                <li><strong>Courses</strong> — adds new courses and updates existing ones as the spreadsheet changes</li>
                <li><strong>Students</strong> — upserts by Student ID (name, year group, form group); no class enrolments yet — those are added per year group when ready</li>
                <li><strong>Attendance Log</strong> — imports new records once students are enrolled in a course</li>
                <li><strong>KPI Benchmarks</strong> — replaces attendance and punctuality thresholds each run</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
