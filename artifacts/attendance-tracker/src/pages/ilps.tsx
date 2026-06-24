import { useState } from "react";
import { useListIlps } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, PlusCircle } from "lucide-react";

export default function Ilps() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { data: ilps, isLoading } = useListIlps();

  const filteredIlps = ilps?.filter(ilp => statusFilter === "all" || ilp.status === statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Individual Learning Plans</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage student ILPs.</p>
        </div>
        <Button className="gap-2">
          <PlusCircle className="w-4 h-4" /> Create ILP
        </Button>
      </div>

      <Card>
        <CardHeader className="py-4 border-b flex flex-row items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">ILP Records</CardTitle>
          </div>
          <div className="flex gap-2">
             <Button variant={statusFilter === "all" ? "secondary" : "ghost"} size="sm" onClick={() => setStatusFilter("all")}>All</Button>
             <Button variant={statusFilter === "active" ? "secondary" : "ghost"} size="sm" onClick={() => setStatusFilter("active")}>Active</Button>
             <Button variant={statusFilter === "draft" ? "secondary" : "ghost"} size="sm" onClick={() => setStatusFilter("draft")}>Draft</Button>
             <Button variant={statusFilter === "completed" ? "secondary" : "ghost"} size="sm" onClick={() => setStatusFilter("completed")}>Completed</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 divide-y">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4"><Skeleton className="h-12 w-full" /></div>
            ))
          ) : filteredIlps?.length ? (
            filteredIlps.map(ilp => (
              <div key={ilp.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{ilp.title}</h3>
                    <Badge variant={ilp.status === 'active' ? 'default' : ilp.status === 'completed' ? 'outline' : 'secondary'} className="capitalize text-[10px] px-1.5 py-0">
                      {ilp.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Learner: {ilp.studentName}</p>
                </div>
                <Button variant="ghost" size="sm">View</Button>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-muted-foreground">No ILPs found.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
