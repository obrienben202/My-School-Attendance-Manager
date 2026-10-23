export type RegisterStatusCode = "P" | "A" | "L" | "O" | "E" | "D" | "N";
export type AttendanceApiStatus =
  | "present"
  | "absent"
  | "late"
  | "authorised"
  | "excluded"
  | "distance_learning";

export const STATUS_TO_API: Partial<Record<RegisterStatusCode, AttendanceApiStatus>> = {
  P: "present",
  A: "absent",
  L: "late",
  O: "authorised",
  E: "excluded",
  D: "distance_learning",
};

export const API_TO_STATUS: Record<AttendanceApiStatus, RegisterStatusCode> = {
  present: "P",
  absent: "A",
  late: "L",
  authorised: "O",
  excluded: "E",
  distance_learning: "D",
};

export function statusFromApi(status: string): RegisterStatusCode {
  return API_TO_STATUS[status as AttendanceApiStatus] ?? "N";
}