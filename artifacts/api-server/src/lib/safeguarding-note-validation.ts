const MAX_NOTE_LENGTH = 10_000;

export function validateSafeguardingNoteInput(input: {
  studentId: number;
  content: string;
}): string | null {
  if (!Number.isInteger(input.studentId) || input.studentId <= 0) {
    return "Select a learner before sending the note.";
  }

  const content = input.content.trim();
  if (!content) {
    return "Enter a note before sending.";
  }
  if (content.length > MAX_NOTE_LENGTH) {
    return "The note must be 10,000 characters or fewer.";
  }

  return null;
}