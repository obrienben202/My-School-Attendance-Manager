import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useMaintainTermlyIlps } from "@workspace/api-client-react";
import { errorMessage, useTermlyAdmin } from "@/hooks/use-termly";
import { formAcademicYears, termlyForms, templateEditorLink } from "@/components/termly/form-associations";
import { Button } from "@/components/ui/button";
import { IlpAdminNav } from "./_nav";
import { FileText } from "lucide-react";

export default function IlpHeaders() {
  const q = useTermlyAdmin();
  const qc = useQueryClient();
  const seed = useMaintainTermlyIlps();
  const [message, setMessage] = useState("");
  const headers = termlyForms(q.data?.templates ?? []);
  const missingTerms = [1, 2, 3].filter(term => !headers.some(header => header.term === term));

  function createTermlyForms() {
    setMessage("");
    seed.mutate({ data: { action: "seed" } }, {
      onSuccess: () => {
        setMessage("Term 1–3 forms created. Open a template to view its title and introduction.");
        qc.invalidateQueries({ predicate: query => String(query.queryKey[0]).startsWith("/api/termly-ilps") });
      },
      onError: error => setMessage(errorMessage(error)),
    });
  }

  return (
    <div className="flex -mx-6 -mt-6 min-h-screen bg-slate-50">
      <IlpAdminNav active="Headers" />
      <div className="flex-1 min-w-0 overflow-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Headers</h1>
            <p className="text-sm text-gray-500 mt-0.5">The real titles and introductions used by the Term 1, Term 2 and Term 3 ILP forms.</p>
          </div>
          {q.data && headers.length > 0 && <div className="flex flex-wrap gap-2">
            <Link className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800" href={templateEditorLink()}>Manage termly forms</Link>
            {missingTerms.length > 0 && <Button onClick={createTermlyForms} disabled={seed.isPending} variant="outline">{seed.isPending ? "Creating…" : "Create missing Term 1–3 forms"}</Button>}
          </div>}
        </div>

        <p className="mb-4 text-sm text-gray-600">Year 7–11 groups use these same termly forms. Academic years appear once a form is used by a published term. To change a published form, clone a new draft in Templates; existing reviews keep their original version.</p>
        {message && <p role={seed.isError ? "alert" : "status"} className={`mb-4 text-sm ${seed.isError ? "text-red-700" : "text-teal-800"}`}>{message}</p>}
        {q.isLoading && <p role="status">Loading termly headers…</p>}
        {q.isError && <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{errorMessage(q.error)}</p><button className="mt-2 underline" onClick={() => q.refetch()}>Retry</button>
        </div>}
        {q.data && !q.isError && <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Header Name</th>
                <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Description</th>
                <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Academic year / status</th>
                <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Associated ILPs</th>
                <th className="px-4 py-2.5">Template</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {headers.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-gray-600 text-sm">
                  <p className="mb-3">No termly forms have been created yet. Create the three school ILP forms to populate Headers and each group's Associated ILPs.</p>
                  <Button data-testid="button-create-termly-forms" onClick={createTermlyForms} disabled={seed.isPending} className="bg-teal-700 hover:bg-teal-800">{seed.isPending ? "Creating…" : "Create Term 1–3 forms"}</Button>
                  <p className="mt-2 text-xs">This creates draft templates, not learner reviews. Publish a term when you are ready to open it to learners.</p>
                </td></tr>
              ) : headers.map((h) => (
                <tr key={h.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-900 flex items-center gap-2">
                    <FileText size={14} className="text-indigo-400 shrink-0" />
                    <div data-testid={`termly-header-${h.id}`}>
                      <p>{h.content.title}</p><p className="text-xs font-normal text-gray-500">Term {h.term} ILP · Version {h.version}</p>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs max-w-xs whitespace-pre-wrap">{h.content.welcome || "No introduction recorded."}</td>
                  <td className="px-4 py-2.5 text-xs">
                    <p>{formAcademicYears(h.id, q.data.terms).join(", ") || "Not used by a published term"}</p><p className="mt-1 capitalize text-gray-500">{h.status}</p>
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    <span className="rounded bg-blue-50 px-2 py-0.5 font-medium text-blue-700">{q.data.reviews.filter(review => review.templateId === h.id).length} learner reviews</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Link className="whitespace-nowrap font-medium text-teal-700 underline" data-testid={`open-termly-header-${h.id}`} href={templateEditorLink(h.id)}>{h.status === "draft" ? "Edit header" : "View template"}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
      </div>
    </div>
  );
}
