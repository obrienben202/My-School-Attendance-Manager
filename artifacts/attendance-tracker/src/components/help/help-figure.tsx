import { useState } from "react";
import { ZoomIn } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { HelpTopic } from "@/lib/staff-help";

export function HelpFigure({ topic }: { topic: HelpTopic }) {
  const [failed, setFailed] = useState(false);
  const src = `${import.meta.env.BASE_URL}${topic.image}`;
  const alt = `Illustrated example of the ${topic.title} screen with numbered markers 1 to ${topic.callouts.length}: ${topic.callouts.map((c) => c.title).join(", ")}.`;
  if (failed) {
    return <p role="alert" className="rounded-md border border-border bg-muted p-4 text-sm">The illustration could not be loaded. The numbered explanations below still apply.</p>;
  }
  return (
    <figure className="m-0">
      <Dialog>
        <DialogTrigger asChild>
          <button type="button" data-testid="button-zoom-help-image" aria-label={`Enlarge illustration: ${topic.title}`} className="group relative block w-full overflow-hidden rounded-lg border border-border bg-card text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <img src={src} alt={alt} data-testid="img-help-guide" onError={() => setFailed(true)} className="block h-auto w-full" />
            <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded bg-card/95 px-2 py-1 text-xs font-medium shadow-sm"><ZoomIn className="h-3.5 w-3.5" /> Enlarge</span>
          </button>
        </DialogTrigger>
        <DialogContent className="max-h-[92dvh] w-[96vw] max-w-5xl overflow-auto">
          <DialogTitle>{topic.title}</DialogTitle>
          <DialogDescription>Illustrated example - no live learner data.</DialogDescription>
          <img src={src} alt={alt} className="h-auto w-full min-w-[640px]" />
        </DialogContent>
      </Dialog>
      <figcaption className="mt-2 text-xs text-muted-foreground">Illustrated example - no live learner data. Numbers on the picture match the explanations below.</figcaption>
    </figure>
  );
}
