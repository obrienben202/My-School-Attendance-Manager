const FIELD_LABELS: Record<string, string> = {
  day: "Day",
  startTime: "Start time",
  endTime: "End time",
  room: "Room",
  weekPattern: "Week pattern",
};

export async function slotSaveError(response: Response, fallback: string): Promise<Error> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return new Error(fallback);
  }

  if (body && typeof body === "object") {
    const payload = body as { error?: unknown; issues?: unknown };
    if (Array.isArray(payload.issues)) {
      const messages = payload.issues
        .filter((issue): issue is { path?: unknown; message: string } =>
          issue !== null && typeof issue === "object" && typeof issue.message === "string")
        .map(issue => {
          const field = Array.isArray(issue.path) ? issue.path[0] : undefined;
          const label = typeof field === "string" ? FIELD_LABELS[field] : undefined;
          return label ? `${label}: ${issue.message}` : issue.message;
        });
      if (messages.length) return new Error(messages.join(" "));
    }
    if (typeof payload.error === "string" && payload.error !== "Invalid body") {
      return new Error(payload.error);
    }
  }
  return new Error(fallback);
}