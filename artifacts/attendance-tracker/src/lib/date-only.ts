export function toLocalDateOnlyValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** The school's teaching day is independent of the viewer's device timezone. */
export function toSchoolDateOnlyValue(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (part: "year" | "month" | "day") =>
    parts.find(item => item.type === part)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function formatDateOnly(value: string, locale = "en-GB"): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString(locale);
}