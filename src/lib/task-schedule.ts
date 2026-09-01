import type { TaskItem } from "@/workspace/types";

export const RECURRENCE_LABELS: Record<Exclude<TaskItem["recurrence"], undefined>, string> = {
  none: "Does not repeat",
  daily: "Daily",
  weekdays: "Mon–Fri",
  custom: "Custom days",
  "specific-time": "Specific time",
};

export const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

/** True when a recurring task is scheduled to occur on today's weekday. */
export function isTaskDueToday(t: TaskItem): boolean {
  if (!t.recurrence || t.recurrence === "none") return false;
  const day = new Date().getDay();
  if (t.recurrence === "daily" || t.recurrence === "specific-time") return true;
  if (t.recurrence === "weekdays") return day >= 1 && day <= 5;
  if (t.recurrence === "custom") return (t.customDays ?? []).includes(day);
  return false;
}
