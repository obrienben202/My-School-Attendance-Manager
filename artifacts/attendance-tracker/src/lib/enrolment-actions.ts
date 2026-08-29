export const MAX_ENROLMENT_PHOTO_BYTES = 5 * 1024 * 1024;
export const ENROLMENT_PHOTO_TYPES = ["image/jpeg", "image/png"] as const;
export type EnrolmentPhotoType = (typeof ENROLMENT_PHOTO_TYPES)[number];

export function validateEnrolmentPhoto(file: Pick<File, "size" | "type">): string {
  if (!ENROLMENT_PHOTO_TYPES.includes(file.type as EnrolmentPhotoType)) {
    return "Choose a JPEG or PNG image.";
  }
  if (file.size <= 0) return "The selected image is empty.";
  if (file.size > MAX_ENROLMENT_PHOTO_BYTES) {
    return "Choose an image smaller than 5MB.";
  }
  return "";
}

export type AgreementHandoffInput = {
  recipient?: string | null;
  learnerName: string;
  courseName: string;
  courseCode: string;
};

export type AgreementHandoff =
  | { ok: true; mailto: string; subject: string; body: string }
  | { ok: false; error: string };

export function buildAgreementHandoff(input: AgreementHandoffInput): AgreementHandoff {
  const recipient = input.recipient?.trim() ?? "";
  if (!recipient) {
    return { ok: false, error: "Add a learner email address before preparing the agreement." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    return { ok: false, error: "Correct the learner email address before preparing the agreement." };
  }

  const learnerName = input.learnerName.trim();
  const courseName = input.courseName.trim();
  if (!learnerName || !courseName) {
    return { ok: false, error: "Learner and course details are required to prepare the agreement." };
  }

  const subject = `Learning agreement for ${learnerName} — ${input.courseCode}`;
  const body = [
    `Hello ${learnerName},`,
    "",
    `Please review the learning agreement for ${courseName} (${input.courseCode}).`,
    "",
    "Reply to this email if any details need correcting before you agree to it.",
    "",
    "Kind regards,",
    "Learner Services",
  ].join("\n");
  const mailto = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return { ok: true, mailto, subject, body };
}

export function enrolmentActionErrorMessage(error: unknown, fallback: string) {
  const data = (error as { data?: { error?: unknown } } | null)?.data;
  return typeof data?.error === "string" ? data.error : fallback;
}