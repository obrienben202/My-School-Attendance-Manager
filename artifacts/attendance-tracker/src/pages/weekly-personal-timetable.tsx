import { useMemo } from "react";
import type { PersonalSlot } from "./my-timetable-query";
import {
  buildWeeklyTimetable, sessionDetails, sessionTime, timetableDays,
  type TimetableEntry,
} from "./my-timetable-presentation";

function Entry({ entry }: { entry: TimetableEntry }) {
  const { slot, sourceIndex, crossPeriod } = entry;
  const details = sessionDetails(slot);
  return (
    <div
      className={`break-words rounded-md border px-2 py-1.5 text-left text-[11px] leading-snug ${crossPeriod ? "border-dashed border-[#6aa9a1] bg-[#e3f3ef] dark:border-teal-600 dark:bg-teal-900/40" : "border-[#cfe6e1] bg-[#f1f8f6] dark:border-border dark:bg-muted"}`}
      data-testid={`row-timetable-${slot.id}-${sourceIndex}`}
    >
      <p className="font-semibold text-[#263c4d] dark:text-foreground">{slot.description}</p>
      <p className="font-medium text-[#287c75] dark:text-teal-300">{sessionTime(slot)}</p>
      {details && <p className="text-[#728391] dark:text-muted-foreground">{details}</p>}
      {crossPeriod && <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-[#3c7f78] dark:text-teal-300">Spans periods</p>}
    </div>
  );
}

export default function WeeklyPersonalTimetable({ slots }: { slots: PersonalSlot[] }) {
  const { rows, additional } = useMemo(() => buildWeeklyTimetable(slots), [slots]);
  const border = "border border-[#d5e2e3] dark:border-border";
  return (
    <div className="min-w-0 max-w-full">
      <div className="max-w-full overflow-x-auto rounded-lg border border-[#d5e2e3] dark:border-border">
        <table className="w-full min-w-[820px] table-fixed border-collapse text-xs" data-testid="table-weekly-timetable">
          <caption className="border-b border-[#d5e2e3] bg-[#e9f5f2] px-3 py-2 text-center text-sm font-bold text-[#1d3044] dark:border-border dark:bg-muted dark:text-foreground">Timetable</caption>
          <thead className="bg-[#e9f5f2] dark:bg-muted">
            <tr>
              <th scope="col" className={`${border} w-[130px] px-2 py-2 text-left text-[11px] font-bold text-[#1d3044] dark:text-foreground`}>Lesson / Time</th>
              {timetableDays.map(day => (
                <th key={day} scope="col" className={`${border} px-2 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-[#3a5a6a] dark:text-foreground`}>{day}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.label} className={row.band ? "bg-[#f6f9fa] dark:bg-muted/40" : ""}>
                <th scope="row" className={`${border} px-2 py-2 text-left align-top font-semibold text-[#263c4d] dark:text-foreground`}>
                  <span className="block">{row.band ? "" : row.label}</span>
                  <span className="block text-[10px] font-medium text-[#7b8a98] dark:text-muted-foreground">{row.start}–{row.end}</span>
                  {row.band && <span className="sr-only">{row.label}</span>}
                </th>
                {row.band ? (
                  <td colSpan={5} className={`${border} px-3 py-2 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-[#6a7f8d] dark:text-muted-foreground`}>{row.label}</td>
                ) : row.cells.map((cell, index) => (
                  <td key={index} className={`${border} min-w-0 break-words p-1.5 align-top`}>
                    {cell.length > 0 && <div className="space-y-1.5">{cell.map(entry => <Entry key={entry.sourceIndex} entry={entry} />)}</div>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {additional.length > 0 && (
        <section className="mt-4" aria-labelledby="timetable-additional" data-testid="section-additional-timetable">
          <h3 id="timetable-additional" className="mb-2 text-xs font-bold uppercase tracking-wide text-[#5a7180] dark:text-muted-foreground">Additional / unplaced sessions</h3>
          <p className="mb-2 text-xs text-[#728391] dark:text-muted-foreground">These recorded sessions do not fit the lesson grid. No times have been changed.</p>
          <ul className="space-y-1.5">
            {additional.map(({ slot, sourceIndex, reason }) => (
              <li key={sourceIndex} className="break-words rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200" data-testid={`row-additional-${sourceIndex}`}>
                <span className="font-semibold">{slot.description}</span>
                <span> · {slot.day || "Day not recorded"} · {sessionTime(slot)}</span>
                {sessionDetails(slot) && <span> · {sessionDetails(slot)}</span>}
                <p className="mt-0.5 font-medium">{reason}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
