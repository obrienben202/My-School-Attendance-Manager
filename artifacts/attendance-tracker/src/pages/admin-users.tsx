import { useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useRole, type Role } from "@/hooks/use-role";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Trash2, ShieldAlert, Users, RefreshCw } from "lucide-react";
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
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-700 border-red-200",
  hod: "bg-purple-100 text-purple-700 border-purple-200",
  staff: "bg-blue-100 text-blue-700 border-blue-200",
  office: "bg-green-100 text-green-700 border-green-200",
};

export default function AdminUsers() {
  const role = useRole();
  const { user } = useAuth();
  const currentUserId = (user as { id?: string } | null)?.id;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<StaffUser | null>(null);
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/sync-users", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json() as { synced?: number; errors?: string[]; error?: string };
      if (!res.ok) {
        toast({ title: data.error ?? "Sync failed", variant: "destructive" });
      } else {
        toast({ title: `Synced ${data.synced ?? 0} users from Google Sheet` });
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
    enabled: role === "admin",
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, newRole }: { id: string; newRole: string }) => {
      const res = await fetch(`/api/admin/users/${id}/role`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error("Failed to update role");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "Role updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update role", variant: "destructive" });
    },
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

  if (role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-400">
        <ShieldAlert className="w-12 h-12" />
        <p className="text-base font-medium">Admin access required</p>
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
            <p className="text-sm text-slate-500">Manage staff accounts and role assignments</p>
          </div>
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
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-6 text-sm text-blue-800">
          <strong>Tip:</strong> Click <strong>Sync from Google Sheet</strong> to pull in new staff, update passwords, or change roles from the spreadsheet. Changes take effect immediately.
        </div>

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
                  <th className="px-4 py-3 font-semibold text-slate-600">Current Role</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Change Role</th>
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
                      <td className="px-4 py-3">
                        <Select
                          value={u.role}
                          onValueChange={(val) =>
                            updateRoleMutation.mutate({ id: u.id, newRole: val })
                          }
                          disabled={isSelf}
                        >
                          <SelectTrigger className="w-48 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="hod">Head of Department</SelectItem>
                            <SelectItem value="staff">Staff</SelectItem>
                            <SelectItem value="office">Office Staff</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          disabled={isSelf}
                          onClick={() => setDeleteTarget(u)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
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
