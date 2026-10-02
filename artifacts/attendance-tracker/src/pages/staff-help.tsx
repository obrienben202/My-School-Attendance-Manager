import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, ArrowRight, BookOpenCheck, ExternalLink, Search } from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { getHelpTopics, type HelpTopic } from "@/lib/staff-help";
import { HelpFigure } from "@/components/help/help-figure";

function Overview({ topics }: { topics: HelpTopic[] }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? topics.filter((t) => `${t.title} ${t.summary} ${t.category}`.toLowerCase().includes(n)) : topics;
  }, [q, topics]);
  const cats = Array.from(new Set(shown.map((t) => t.category)));
  return (
    <div className="mx-auto max-w-5xl space-y-5" data-testid="page-staff-help">
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-[#32776f]"><BookOpenCheck className="h-5 w-5" /><h1 className="text-xl font-bold text-foreground">Staff Help Guide</h1></div>
        <p className="mt-1 text-sm text-muted-foreground">One page per area of the portal, with an illustrated example so you can recognise each screen. Pictures use example data only.</p>
        <div className="relative mt-4 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input type="search" aria-label="Search help topics" data-testid="input-help-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search topics" className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
      </div>
      {shown.length === 0 && <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground" data-testid="text-help-empty">No topics match "{q}". Try a shorter word.</p>}
      {cats.map((c) => (
        <section key={c} aria-labelledby={`cat-${c.replace(/\W+/g, "-")}`}>
          <h2 id={`cat-${c.replace(/\W+/g, "-")}`} className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{c}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {shown.filter((t) => t.category === c).map((t) => (
              <li key={t.slug}>
                <Link href={`/help/${t.slug}`} data-testid={`link-help-topic-${t.slug}`} className="block h-full rounded-lg border border-border bg-card p-4 hover:border-[#458980] hover:bg-muted/40">
                  <span className="block font-semibold">{t.title}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{t.summary}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Topic({ topic, topics }: { topic: HelpTopic; topics: HelpTopic[] }) {
  const i = topics.findIndex((t) => t.slug === topic.slug);
  const prev = topics[i - 1], next = topics[i + 1];
  return (
    <article className="mx-auto max-w-4xl space-y-6" data-testid={`page-help-${topic.slug}`}>
      <nav aria-label="Guide navigation"><Link href="/help" data-testid="link-help-overview" className="inline-flex items-center gap-1 text-sm text-[#32776f] hover:underline"><ArrowLeft className="h-4 w-4" /> All help topics</Link></nav>
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{topic.category}</p>
        <h1 className="text-2xl font-bold tracking-tight">{topic.title}</h1>
        <p className="mt-1 text-muted-foreground">{topic.summary}</p>
      </header>
      <HelpFigure key={topic.slug} topic={topic} />
      <section aria-labelledby="h-callouts" className="rounded-lg border border-border bg-card p-4">
        <h2 id="h-callouts" className="mb-3 font-semibold">What is what</h2>
        <ol className="space-y-3">
          {topic.callouts.map((c) => (
            <li key={c.number} className="flex gap-3">
              <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#c2410c] text-xs font-bold text-white">{c.number}</span>
              <p className="text-sm"><strong>{c.title}.</strong> <span className="text-muted-foreground">{c.description}</span></p>
            </li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="h-steps">
        <h2 id="h-steps" className="mb-3 font-semibold">Step by step</h2>
        <ol className="space-y-2">
          {topic.steps.map((s, n) => (
            <li key={n} className="flex gap-3 rounded-lg border border-border bg-card p-3 text-sm">
              <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[#e1efec] text-xs font-bold text-[#32776f]">{n + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </section>
      {topic.notes.length > 0 && (
        <section aria-labelledby="h-notes" className="rounded-lg border border-amber-300/60 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          <h2 id="h-notes" className="mb-2 font-semibold">Good to know</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">{topic.notes.map((n, k) => <li key={k}>{n}</li>)}</ul>
        </section>
      )}
      <Link href={topic.href} data-testid="link-help-live-page" className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[#458980] px-4 text-sm font-medium text-white hover:bg-[#3a756d]">Open this page in the portal <ExternalLink className="h-4 w-4" /></Link>
      <nav aria-label="Previous and next topics" className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
        {prev ? <Link href={`/help/${prev.slug}`} data-testid="link-help-prev" className="inline-flex items-center gap-2 text-sm hover:underline"><ArrowLeft className="h-4 w-4" /> {prev.title}</Link> : <span />}
        {next && <Link href={`/help/${next.slug}`} data-testid="link-help-next" className="inline-flex items-center gap-2 text-sm hover:underline">{next.title} <ArrowRight className="h-4 w-4" /></Link>}
      </nav>
    </article>
  );
}

export default function StaffHelp() {
  const role = useRole();
  const [match, params] = useRoute("/help/:topic");
  const topics = useMemo(() => getHelpTopics(role), [role]);
  const start = useRef<HTMLDivElement>(null);
  useEffect(() => {
    start.current?.scrollIntoView({ block: "start" });
  }, [params?.topic, role]);
  if (role === "learner") return null;
  if (!match) return <div ref={start} className="scroll-mt-20"><Overview topics={topics} /></div>;
  const topic = topics.find((t) => t.slug === params.topic);
  if (!topic) {
    return (
      <div className="mx-auto max-w-xl rounded-lg border border-dashed border-border p-8 text-center" data-testid="text-help-unknown">
        <h1 className="text-lg font-bold">Help topic not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">This topic does not exist or is not available for your account.</p>
        <Link href="/help" className="mt-4 inline-block text-sm text-[#32776f] hover:underline">Back to all help topics</Link>
      </div>
    );
  }
  return <div ref={start} className="scroll-mt-20"><Topic topic={topic} topics={topics} /></div>;
}
