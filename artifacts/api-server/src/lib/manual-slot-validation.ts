import { insertScheduleSchema } from "@workspace/db/schema";
import { normalizeTeachingDay } from "./schedule-day";

const slotBody = insertScheduleSchema.omit({ courseId: true });
const weekdayMessage = "Day must be Monday, Tuesday, Wednesday, Thursday or Friday";

// A new slot cannot inherit the database's nullable legacy day.
export const CreateSlotBody = slotBody
  .refine(body => normalizeTeachingDay(body.day) !== null, { path: ["day"], message: weekdayMessage })
  .transform(body => ({ ...body, day: normalizeTeachingDay(body.day)! }));

// PUT is a partial update: leaving day out preserves a legacy null/invalid day,
// but supplying one must always replace it with a recognized teaching weekday.
export const UpdateSlotBody = slotBody
  .refine(body => body.day === undefined || normalizeTeachingDay(body.day) !== null, {
    path: ["day"],
    message: weekdayMessage,
  })
  .transform(body => body.day === undefined
    ? body
    : { ...body, day: normalizeTeachingDay(body.day)! });