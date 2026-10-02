import { useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import type { UserSyncSummary } from "@workspace/api-client-react";
import { useRole, type Role } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Trash2, ShieldAlert, Users, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type StaffUser = {
  id: string;
  username: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  role: string;
  department: string | null;
  createdAt: string;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  hod: "Head of Department",
  staff: "Staff",
  office: "Office Staff",
  learner: "Learner",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-700 border-red-200",
  hod: "bg-purple-100 text-purple-700 border-purple-200",
  staff: "bg-blue-100 text-blue-700 border-blue-200",
  office: "bg-green-100 text-green-700 border-green-200",
  learner: "bg-teal-100 text-teal-700 border-teal-200",
};

export default function AdminUsers() {
  const role = useRole();
  const { user } = useAuth();
  const currentUserId = (user as { id?: string } | null)?.id;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<StaffUser | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<UserSyncSummary | null>(null);
  const isAdmin = role === "admin";
  const canView = role === "admin" || role === "hod";

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/sync-users", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json() as {
        synced?: number;
        summary?: UserSyncSummary;
        error?: string;
      };
      if (data.summary) setSyncResult(data.summary);
      if (!res.ok) {
        toast({
          title: "Directory sync needs review",
          description: data.summary?.errors[0] ?? data.error ?? "The directory was not applied.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Directory roles synchronized",
          description: `${data.summary?.inserted ?? 0} added, ${data.summary?.updated ?? 0} updated, ${data.summary?.unchanged ?? 0} unchanged.`,
        });
        queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      }
    } catch {
      toast({ title: "Could not connect to sync endpoint", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }

  const { data: users = [], isLoading } = useQuery<StaffUser[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    enabled: canView,
    refetchInterval: 5000,
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to remove user");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setDeleteTarget(null);
      toast({ title: "User removed successfully" });
    },
    onError: () => {
      toast({ title: "Failed to remove user", variant: "destructive" });
    },
  });

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-400">
        <ShieldAlert className="w-12 h-12" />
        <p className="text-base font-medium">Admin or Head of Department access required</p>
      </div>
    );
  }

  const roleOrder: Role[] = ["admin", "hod", "staff", "office"];
  const sortedUsers = [...users].sort((a, b) => {
    return roleOrder.indexOf(a.role as Role) - roleOrder.indexOf(b.role as Role);
  });

  return (
    <div className="-mx-6 -mt-6">
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
            <Users className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-800">User Management</h1>
            <p className="text-sm text-slate-500">Directory-managed staff accounts and roles</p>
          </div>
          {isAdmin && (
            <Button
              onClick={handleSync}
              disabled={syncing}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync from Google Sheet"}
            </Button>
          )}
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-6 text-sm text-blue-800">
          {isAdmin
            ? <><strong>Directory managed:</strong> Roles cannot be changed here. Update the school directory, then sync it. Valid role changes take effect for active sessions immediately.</>
            : <><strong>Directory managed:</strong> You have view-only access. Role changes must be made in the school directory by an administrator.</>}
        </div>

        {syncResult && (
          <div className={`rounded-lg border px-4 py-3 mb-6 text-sm ${
            syncResult.invalid > 0 || syncResult.duplicates > 0
              ? "bg-red-50 border-red-200 text-red-800"
              : syncResult.unmatched > 0
                ? "bg-amber-50 border-amber-200 text-amber-900"
                : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}>
            <div className="flex items-start gap-2">
              {(syncResult.invalid > 0 || syncResult.duplicates > 0 || syncResult.unmatched > 0) && (
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              )}
              <div>
                <p className="font-semibold">Latest user reconciliation</p>
                <p className="mt-1">
                  {syncResult.inserted} inserted · {syncResult.updated} updated · {syncResult.unchanged} unchanged ·{" "}
                  {syncResult.invalid} invalid · {syncResult.duplicates} duplicate · {syncResult.unmatched} unmatched local
                </p>
                {syncResult.unmatched > 0 && (
                  <p className="mt-1">Unmatched local accounts were reported only; no accounts were automatically removed.</p>
                )}
                {syncResult.errors.length > 0 && (
                  <ul className="mt-2 list-disc list-inside space-y-1">
                    {syncResult.errors.map((error) => <li key={error}>{error}</li>)}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="text-slate-400 text-sm py-12 text-center animate-pulse">Loading users…</div>
        ) : sortedUsers.length === 0 ? (
          <div className="text-slate-400 text-sm py-12 text-center">No users found.</div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <th className="px-4 py-3 font-semibold text-slate-600">Name</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Username</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Department</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Directory Role</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((u, idx) => {
                  const isSelf = u.id === currentUserId;
                  return (
                    <tr
                      key={u.id}
                      className={`border-b border-slate-100 last:border-0 ${idx % 2 === 0 ? "" : "bg-slate-50/50"}`}
                    >
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {u.firstName || u.lastName
                          ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()
                          : "—"}
                        {isSelf && (
                          <span className="ml-2 text-xs text-slate-400">(you)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-xs">{u.username ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-500">{u.department ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${ROLE_COLORS[u.role] ?? "bg-slate-100 text-slate-600"}`}
                        >
                          {ROLE_LABELS[u.role] ?? u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            disabled={isSelf}
                            onClick={() => setDeleteTarget(u)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(["admin", "hod", "staff", "office"] as const).map((r) => (
            <div key={r} className="bg-white border border-slate-200 rounded-lg p-3">
              <div className={`text-xs font-semibold mb-1 ${ROLE_COLORS[r]?.split(" ")[1]}`}>
                {ROLE_LABELS[r]}
              </div>
              <div className="text-2xl font-bold text-slate-700">
                {users.filter((u) => u.role === r).length}
              </div>
              <div className="text-xs text-slate-400">user{users.filter((u) => u.role === r).length !== 1 ? "s" : ""}</div>
            </div>
          ))}
        </div>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove{" "}
              <strong>
                {deleteTarget?.firstName} {deleteTarget?.lastName}
              </strong>{" "}
              from the system. They will lose access immediately. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteTarget && deleteUserMutation.mutate(deleteTarget.id)}
            >
              Remove user
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
