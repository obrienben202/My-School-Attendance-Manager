import type { IlpGroupConflict } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";

export function readGroupConflict(error: unknown): IlpGroupConflict | null {
  if (!error || typeof error !== "object" || !("data" in error)) return null;
  const data = error.data as IlpGroupConflict | null;
  return data && (data.code === "GROUP_REVISION_CONFLICT" || data.code === "GROUP_NOT_FOUND") ? data : null;
}

export function GroupConflict({
  conflict, deleting = false, onReload, onReconcile,
}: {
  conflict: IlpGroupConflict;
  deleting?: boolean;
  onReload: () => void;
  onReconcile?: () => void;
}) {
  const current = conflict.current;
  return (
    <div role="alert" className="space-y-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
      <p className="font-semibold">{current ? "Another administrator changed this group." : "This group has been deleted."}</p>
      {!deleting && <p>Your unsaved name and filters are still in the editor above. Nothing from this attempt was saved.</p>}
      {current ? (
        <>
          <div className="space-y-1">
            <p className="font-semibold">Latest saved version (revision {current.revision})</p>
            <p className="break-words">Name: {current.name}</p>
            <p>Filters: {current.filters.length ? current.filters.map(f => `${f.field} ${f.operator} ${f.value}`).join("; ") : "No filters"}</p>
          </div>
          <p>{deleting
            ? "Review the latest version before confirming deletion again."
            : "Reload to replace your draft, or reconcile using your values. Reconcile keeps your draft for editing; the next Save replaces the saved name and filters shown here, unless someone changes them again."}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onReload}>
              {deleting ? "Review latest before deleting" : "Reload latest (discard my draft)"}
            </Button>
            {!deleting && <Button variant="outline" onClick={onReconcile}>Reconcile using my values</Button>}
          </div>
        </>
      ) : <p>{deleting ? "There is nothing left to delete. Close this dialog to refresh the list." : "You can copy your unsaved values before closing. Saving cannot recreate or overwrite the deleted group."}</p>}
    </div>
  );
}
