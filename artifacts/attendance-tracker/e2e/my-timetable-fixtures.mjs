// Synthetic browser responses only: never insert these into staff assignments.
export const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const slot = (overrides) => ({
  id: "fixture", day: "Monday", startTime: "09:00", endTime: "09:55",
  description: "Fixture lesson", groupLabel: "Synthetic group", room: "Fixture room",
  weekPattern: "Every week", ...overrides,
});

export const timetableFixture = [
  ...weekdays.map((day, index) => slot({
    id: `day-${index}`, day, description: `${day} fixture lesson`,
    weekPattern: index % 2 ? "Week A only" : "Week B only",
  })),
  // Deliberately share an ID: these are distinct source records, not duplicates to discard.
  slot({ id: "day-0", description: "Overlapping fixture lesson", startTime: "09:10", endTime: "09:40" }),
  slot({ id: "cross", day: "Tuesday", description: "Cross-period fixture lesson", startTime: "11:30", endTime: "12:30" }),
  slot({ id: "early", day: "Wednesday", description: "Early fixture activity", startTime: "08:30", endTime: "09:15" }),
  slot({ id: "lunch", day: "Thursday", description: "Lunch fixture activity", startTime: "12:30", endTime: "13:40" }),
  slot({ id: "unknown", day: "Unscheduled", description: "Unscheduled fixture activity" }),
  slot({ id: "missing", day: "Friday", description: "Missing-time fixture activity", startTime: null }),
  slot({ id: "invalid", description: 'Invalid-time fixture <script> & "quoted"', startTime: "25:00" }),
];

// Explicit expectations, intentionally not computed using the production placement helper.
export const additionalExpectations = [
  { index: 7, reason: "Outside lesson hours" },
  { index: 8, reason: "Overlaps registration, break or lunch" },
  { index: 9, reason: "Weekday not recognised" },
  { index: 10, reason: "Missing or invalid times" },
  { index: 11, reason: "Missing or invalid times" },
];
