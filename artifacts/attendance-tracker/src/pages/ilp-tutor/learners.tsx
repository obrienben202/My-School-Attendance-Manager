import { Link } from "wouter";
import { IlpTutorNav } from "./_nav";
import { useTermlyFeed, errorMessage } from "@/hooks/use-termly";
import { StatusPill } from "@/components/termly/status-pill";

export default function IlpTutorLearners() {
  const q = useTermlyFeed();
  const learners = [...new Map((q.data?.reviews ?? []).map(r => [r.studentId, r.studentName])).entries()];
  return <div className="-mx-6 -mt-6 flex min-h-screen bg-slate-50">
    <IlpTutorNav active="Learners" />
    <main className="min-w-0 flex-1 space-y-4 p-6">
      <h1 className="text-xl font-bold">My assigned learners</h1>
      <p className="text-sm text-slate-600">Confirmed learners assigned to you as RG teacher, with their published term reviews.</p>
      {q.isLoading && <p>Loading assigned learners…</p>}
      {q.isError && <div role="alert"><p>{errorMessage(q.error)}</p><button className="underline" onClick={() => q.refetch()}>Try again</button></div>}
      {q.data && learners.length === 0 && <p>No published reviews are assigned to you yet. Ask an administrator to check the RG teacher assignment and term publication.</p>}
      {learners.map(([id, name]) => <section className="space-y-2 rounded-lg border bg-white p-4" key={id}>
        <h2 className="font-semibold">{name}</h2>
        {q.data!.reviews.filter(r => r.studentId === id).map(r => <div key={r.id} className="flex flex-wrap items-center gap-3 text-sm">
          <Link className="underline" href={`/ilp-tutor/review/${r.id}`}>{r.academicYear} — Term {r.term}</Link>
          <StatusPill status={r.status} overdue={r.overdue} />
          {!r.accountLinked && <span className="text-amber-800">Awaiting learner account setup</span>}
        </div>)}
      </section>)}
    </main>
  </div>;
}