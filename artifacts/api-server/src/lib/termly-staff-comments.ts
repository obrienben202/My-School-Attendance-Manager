type Event = { action: string; actorId: string; at: string; comment?: string };

export const SCHOOL_STAFF_ROLES = ["admin", "hod", "staff", "office"];

export function canAddStaffComment(role: string) {
  return SCHOOL_STAFF_ROLES.includes(role);
}

// Only explicitly separate staff comments may enter the school-wide feed.
// Learner work, teacher comments and the rest of review history stay private.
export function staffCommentsFromHistory(history: Event[], names: Map<string, string>) {
  return history
    .filter(event => event.action === "staff_comment" && !!event.comment?.trim())
    .map(event => ({
      actorId: event.actorId,
      authorName: names.get(event.actorId) || "Former staff member",
      createdAt: event.at,
      text: event.comment!,
    }));
}