import { useState } from "react";
import { useListTargets, useUpdateTarget, getListTargetsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Target as TargetIcon, CheckCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Targets() {
  const [filter, setFilter] = useState<"all" | "overdue" | "active">("all");
  const { data: targets, isLoading } = useListTargets(filter === "overdue" ? { overdue: true } : {});
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateTarget = useUpdateTarget();

  const handleMarkComplete = (id: number) => {
    updateTarget.mutate(
      { id, data: { completed: true } },
      {
        onSuccess: (updated) => {
          toast({ title: "Target completed", description: "SMART target marked as completed." });
          // Invalidate list query
          queryClient.invalidateQueries({ queryKey: getListTargetsQueryKey() });
        }
      }
    );
  };

  const filteredTargets = targets?.filter(t => {
    if (filter === "active") return !t.completed && !t.overdue;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">SMART Targets</h1>
          <p className="text-muted-foreground text-sm mt-1">Monitor and manage learner objectives.</p>
        </div>
        <div className="flex gap-2">
          <Button variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")} size="sm">All</Button>
          <Button variant={filter === "active" ? "default" : "outline"} onClick={() => setFilter("active")} size="sm">Active</Button>
          <Button variant={filter === "overdue" ? "destructive" : "outline"} onClick={() => setFilter("overdue")} size="sm">Overdue</Button>
        </div>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-12 w-full" /></CardContent></Card>
          ))
        ) : filteredTargets?.length ? (
          filteredTargets.map(target => (
            <Card key={target.id} className={target.overdue && !target.completed ? "border-red-200 bg-red-50/10" : ""}>
              <CardContent className="p-6 flex items-start gap-4">
                <div className={`p-2 rounded-full ${target.completed ? "bg-emerald-100 text-emerald-600" : target.overdue ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"}`}>
                  {target.completed ? <CheckCircle className="w-5 h-5" /> : target.overdue ? <Clock className="w-5 h-5" /> : <TargetIcon className="w-5 h-5" />}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{target.title}</h3>
                    {target.completed ? (
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">Completed</Badge>
                    ) : target.overdue ? (
                      <Badge variant="destructive">Overdue</Badge>
                    ) : (
                      <Badge variant="outline">Active</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{target.studentName}</p>
                  {target.description && <p className="text-sm mt-2">{target.description}</p>}
                  <div className="text-xs font-medium text-muted-foreground mt-2">
                    Due: {target.dueDate || "No date set"}
                  </div>
                </div>
                {!target.completed && (
                  <Button variant="outline" size="sm" onClick={() => handleMarkComplete(target.id)} disabled={updateTarget.isPending}>
                    Mark Complete
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              No targets found for the selected filter.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
