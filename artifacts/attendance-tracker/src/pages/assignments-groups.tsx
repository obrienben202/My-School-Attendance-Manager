import { useLocation } from "wouter";
import { useListAssessments, useListCourses } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, ChevronRight, ChevronsUpDown } from "lucide-react";

export default function AssignmentsGroups() {
  const [, navigate] = useLocation();
  const { data: assessments, isLoading } = useListAssessments({}, { query: {} as any });
  const { data: courses } = useListCourses();

  const courseMap = Object.fromEntries((courses ?? []).map(c => [c.id, c]));

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Users className="w-5 h-5 text-teal-700" />
        <div>
          <h1 className="text-lg font-bold text-slate-800">My Assignments / Groups</h1>
          <p className="text-xs text-slate-500">
            Mark assessments grouped by assignment. Select a learner to expand and enter results.
          </p>
        </div>
      </div>

      {/* Info note */}
      <div className="bg-blue-50 border border-blue-200 rounded px-4 py-2 text-xs text-blue-800">
        This lists all assignments/groups where you are linked to the assessments against the UIO and one or more assessment has a grading scheme with a subtype of <strong>PASSORFAIL</strong>. You can filter records in the grid by UIO group from the Group field drop-down list in the Module Details section.
      </div>

      {/* Table */}
      <div className="border border-slate-300 rounded overflow-hidden">
        <div className="bg-slate-700 text-white px-4 py-2 font-semibold text-sm flex items-center justify-between">
          <span>Assignments / Groups</span>
          <span className="text-xs font-normal opacity-75">
            {assessments?.length ?? 0} record{assessments?.length !== 1 ? "s" : ""}
          </span>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {["Code", "Description", "Type", "Course", "Due Date", "Grading Scheme", "Min Pass", "Order", "Mark"].map(col => (
                  <th key={col} className="text-left font-semibold text-slate-600 px-3 py-2">
                    {!["Mark"].includes(col) ? (
                      <span className="flex items-center gap-1 cursor-pointer hover:text-slate-900">
                        {col} <ChevronsUpDown className="w-3 h-3 opacity-50" />
                      </span>
                    ) : col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!assessments?.length ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    No assignments or groups found. Add assessments via My Assessments or the Course Assessment Plan.
                  </td>
                </tr>
              ) : assessments.map(a => {
                const course = courseMap[a.courseId];
                return (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-800">
                      <span className="flex items-center gap-1">
                        <ChevronRight className="w-3 h-3 text-slate-400" />{a.code}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{a.description}</td>
                    <td className="px-3 py-2 text-slate-500">{a.type}</td>
                    <td className="px-3 py-2 text-slate-500">
                      {course ? `${course.code} — ${course.name}` : `Course ${a.courseId}`}
                    </td>
                    <td className="px-3 py-2 text-slate-500">{a.dueDate ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-500">{a.gradingScheme}</td>
                    <td className="px-3 py-2 text-slate-500">{a.minPassMark ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-500">{a.order}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => navigate(`/assignment-results/${a.id}`)}
                        className="text-sky-700 underline text-xs hover:text-sky-900"
                      >
                        Mark
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex justify-between text-xs text-slate-500">
          <span>Showing {assessments?.length ?? 0} of {assessments?.length ?? 0} assignments/groups</span>
          <div className="flex gap-1">
            <button className="w-6 h-6 rounded border border-slate-300 bg-white flex items-center justify-center hover:bg-slate-100 disabled:opacity-40" disabled>‹</button>
            <button className="w-6 h-6 rounded border border-slate-300 bg-white flex items-center justify-center hover:bg-slate-100 disabled:opacity-40" disabled>›</button>
          </div>
        </div>
      </div>
    </div>
  );
}
