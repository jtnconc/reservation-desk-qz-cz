import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlarmClock,
  ArrowUpRight,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  Flag,
  Pin,
  Plus,
  Star,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useWorkspace } from "@/workspace/store";
import type {
  ContactCategory,
  ContactItem,
  ItemStatus,
  NoteRefItem,
  ReminderItem,
  TaskItem,
  Widget,
} from "@/workspace/types";
import { DateField } from "@/components/common/DateField";
import { TimeField } from "@/components/common/TimeField";
import { cn } from "@/lib/utils";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { highlightHtml, highlightText, matchesQuery } from "@/lib/highlight";
import { RECURRENCE_LABELS, WEEKDAY_LABELS, isTaskDueToday } from "@/lib/task-schedule";
import { CALL_HASHTAGS, PROPERTY_STYLES } from "@/lib/property-codes";
import { todayISO, localISODate } from "@/lib/quote-model";
import { DEFAULT_NOTIFY_MINUTES, NOTIFY_OPTIONS, isReminderAlertActive } from "@/lib/reminder-alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { accentVar } from "./AccentControl";
import { FilterChips, type FilterChipOption } from "./FilterChips";
import { SwipeableListItem, SwipeRevealProvider } from "./SwipeableListItem";

/** Fixed swipe-action rail widths (px), sized to the number of icons they
 * hold so the reveal never needs to know about text truncation. */
const RAIL_W_2 = 64;
const RAIL_W_3 = 92;

/** Filter chip definitions for each filterable widget kind — colors follow
 * the brief's grouping (warm tones for Reminders/Tasks, cool for Contacts)
 * while reusing the app's existing predefined accent palette. */
const REMINDER_FILTERS: FilterChipOption[] = [
  { value: "flagged", label: "Flagged", icon: Flag, accent: "red" },
  { value: "scheduled", label: "Scheduled", icon: Clock, accent: "orange" },
  { value: "completed", label: "Completed", icon: CheckCircle2, accent: "yellow" },
];

const TASK_FILTERS: FilterChipOption[] = [
  { value: "urgent", label: "Urgent", icon: AlarmClock, accent: "red" },
  { value: "scheduled", label: "Scheduled", icon: CalendarClock, accent: "orange" },
  { value: "completed", label: "Completed", icon: CheckCircle2, accent: "green" },
];

const CONTACT_FILTERS: FilterChipOption[] = [
  { value: "hotel", label: "Hotel", icon: Building2, accent: "blue" },
  { value: "agent", label: "Agents", icon: Users, accent: "purple" },
  { value: "client", label: "Clients", icon: UserRound, accent: "neutral" },
];

/** Which quick filters a reminder currently satisfies (a reminder can match
 * more than one, e.g. flagged AND scheduled — chips act as an OR union). */
function reminderFilterValues(r: ReminderItem): string[] {
  const values: string[] = [];
  if (r.flagged) values.push("flagged");
  if (reminderState(r) === "completed") values.push("completed");
  else if (splitWhen(r).date) values.push("scheduled");
  return values;
}

function taskFilterValues(t: TaskItem): string[] {
  const values: string[] = [];
  if (t.priority === "urgent") values.push("urgent");
  if (taskState(t.status) === "completed") values.push("completed");
  else if (t.date || t.time || (t.recurrence && t.recurrence !== "none")) values.push("scheduled");
  return values;
}

const contactFilterValue = (p: ContactItem): string => p.category ?? "client";

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

/** Tiny inline action button used by contextual item controls. */
function MiniAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onPointerDown={stop}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-secondary hover:text-foreground"
    >
      {children}
    </button>
  );
}

/** Standard, subtle in-card delete confirmation used by every widget. */
function DeleteAction({
  label,
  confirming,
  onRequest,
  onCancel,
  onConfirm,
}: {
  label: string;
  confirming: boolean;
  onRequest: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!confirming)
    return (
      <MiniAction label={label} onClick={onRequest}>
        <Trash2 className="size-3" />
      </MiniAction>
    );

  return (
    <>
      <MiniAction label={`Confirm ${label.toLowerCase()}`} onClick={onConfirm}>
        <Check className="size-3 text-destructive" />
      </MiniAction>
      <MiniAction label="Cancel delete" onClick={onCancel}>
        <X className="size-3" />
      </MiniAction>
    </>
  );
}

const taskState = (s: string): ItemStatus =>
  s === "done" || s === "completed" ? "completed" : "active";

const reminderState = (r: ReminderItem): ItemStatus =>
  r.status === "archived" ? "archived" : (r.status ?? (r.done ? "completed" : "active"));

/** Legacy values may be "2026-08-18 09:00". */
function splitWhen(r: ReminderItem) {
  const [d, t] = (r.date ?? "").split(" ");
  return { date: d ?? "", time: r.time ?? t ?? "" };
}

/** Formats a reminder's date/time as "MM/DD/YY, h:mm A" (e.g. "08/05/26, 3:00 PM"). */
function formatReminderWhen(when: { date: string; time: string }) {
  if (!when.date) return null;
  const [y, m, d] = when.date.split("-").map(Number);
  if (!y || !m || !d) return null;
  let result = `${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}/${String(y).slice(-2)}`;

  if (when.time) {
    const [hh, mm] = when.time.split(":").map(Number);
    if (!Number.isNaN(hh) && !Number.isNaN(mm)) {
      const period = hh >= 12 ? "PM" : "AM";
      const h12 = hh % 12 === 0 ? 12 : hh % 12;
      result += `, ${h12}:${String(mm).padStart(2, "0")} ${period}`;
    }
  }

  return result;
}

const RECURRENCE_OPTIONS: Exclude<TaskItem["recurrence"], undefined>[] = [
  "none",
  "daily",
  "weekdays",
  "custom",
  "specific-time",
];

/** Inline repeat + date/time scheduling panel shared by every task row. */
function TaskSchedulePanel({
  task,
  onChange,
  onDone,
}: {
  task: TaskItem;
  onChange: (patch: Partial<TaskItem>) => void;
  onDone: () => void;
}) {
  const recurrence = task.recurrence ?? "none";
  return (
    <div className="mt-1.5 space-y-1.5" onClick={stop} onPointerDown={stop}>
      <Select
        value={recurrence}
        onValueChange={(v) =>
          onChange({ recurrence: v as Exclude<TaskItem["recurrence"], undefined> })
        }
      >
        <SelectTrigger
          aria-label="Repeat"
          className="h-auto w-full rounded-xl border-border bg-surface px-2 py-1 text-[11px] shadow-none focus:ring-0 focus-visible:border-ring"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          {RECURRENCE_OPTIONS.map((r) => (
            <SelectItem key={r} value={r} className="text-[12px]">
              {RECURRENCE_LABELS[r]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {recurrence === "custom" && (
        <div className="flex gap-1">
          {WEEKDAY_LABELS.map((label, day) => {
            const active = (task.customDays ?? []).includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={active}
                aria-label={`Repeat on day ${day}`}
                onClick={() => {
                  const set = new Set(task.customDays ?? []);
                  if (set.has(day)) set.delete(day);
                  else set.add(day);
                  onChange({ customDays: [...set].sort() });
                }}
                className={cn(
                  "flex size-6 items-center justify-center rounded-full border text-[10px] font-semibold transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-surface text-muted-foreground hover:bg-secondary",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <DateField
          size="sm"
          value={task.date ?? ""}
          onChange={(iso) => onChange({ date: iso })}
          placeholder="Pick a date"
          aria-label="Task date"
        />
        <TimeField value={task.time ?? ""} onChange={(t) => onChange({ time: t })} />
      </div>

      <button type="button" onClick={onDone} className="label-xs hover:text-foreground">
        Done
      </button>
    </div>
  );
}

function TasksContent({
  widget,
  filtersOpen,
  selectedFilters,
  onToggleFilter,
}: {
  widget: Widget;
  filtersOpen: boolean;
  selectedFilters: string[];
  onToggleFilter: (value: string) => void;
}) {
  const { toggleTask, updateTask, deleteTask, searchQuery } = useWorkspace();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  if (widget.content.kind !== "tasks") return null;
  const showCompleted = selectedFilters.includes("completed");
  const items = widget.content.items
    .filter((t) => matchesQuery(t.title, searchQuery))
    .filter((t) => showCompleted || taskState(t.status) !== "completed")
    .filter(
      (t) =>
        selectedFilters.length === 0 ||
        taskFilterValues(t).some((v) => selectedFilters.includes(v)),
    )
    .map((t, index) => ({ t, index }))
    .sort((a, b) => {
      const aDone = taskState(a.t.status) === "completed";
      const bDone = taskState(b.t.status) === "completed";
      if (aDone !== bDone) return aDone ? 1 : -1;
      return a.index - b.index;
    })
    .map(({ t }) => t);
  const accent = accentVar(widget.accent);

  return (
    <>
      <FilterChips
        options={TASK_FILTERS}
        selected={selectedFilters}
        onToggle={onToggleFilter}
        open={filtersOpen}
      />
      <SwipeRevealProvider>
        <ul className="space-y-2">
        {items.map((t) => {
          const done = taskState(t.status) === "completed";
          const isConfirming = confirming === t.id;
          const isExpanded = expanded === t.id;
          const recurs = !!t.recurrence && t.recurrence !== "none";
          const dueToday = !done && isTaskDueToday(t);
          const urgent = !done && t.priority === "urgent";
          return (
            <motion.li
              key={t.id}
              layout
              transition={{ type: "spring", stiffness: 500, damping: 40, mass: 0.6 }}
            >
              <SwipeableListItem
                id={t.id}
                actionsWidth={RAIL_W_2}
                actions={
                  isConfirming ? (
                    <DeleteAction
                      label="Delete task"
                      confirming
                      onRequest={() => setConfirming(t.id)}
                      onCancel={() => setConfirming(null)}
                      onConfirm={() => {
                        setConfirming(null);
                        deleteTask(widget.id, t.id);
                      }}
                    />
                  ) : (
                    <>
                      <MiniAction
                        label={t.priority === "urgent" ? "Unmark urgent" : "Mark urgent"}
                        onClick={() =>
                          updateTask(widget.id, t.id, {
                            priority: t.priority === "urgent" ? "normal" : "urgent",
                          })
                        }
                      >
                        <AlarmClock
                          className="size-3"
                          style={t.priority === "urgent" ? { color: accentVar("red") } : undefined}
                        />
                      </MiniAction>
                      <DeleteAction
                        label="Delete task"
                        confirming={false}
                        onRequest={() => setConfirming(t.id)}
                        onCancel={() => setConfirming(null)}
                        onConfirm={() => deleteTask(widget.id, t.id)}
                      />
                    </>
                  )
                }
              >
                <div className="flex min-h-6 items-start gap-2 py-0.5">
                  <button
                    type="button"
                    aria-label={done ? "Reopen task" : "Complete task"}
                    onPointerDown={stop}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTask(widget.id, t.id);
                    }}
                    className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors"
                    style={
                      done
                        ? { backgroundColor: accent, borderColor: accent }
                        : { borderColor: "var(--border)" }
                    }
                  >
                    {done && <Check className="size-2.5 text-white" strokeWidth={3} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpanded((v) => (v === t.id ? null : t.id));
                      }}
                      className="flex w-full min-w-0 items-start gap-1.5 text-left"
                    >
                      <span
                        className={cn(
                          "min-w-0 flex-1 break-words text-[13px] leading-snug",
                          done && "text-muted-foreground line-through",
                        )}
                      >
                        {highlightText(t.title, searchQuery)}
                      </span>
                      {urgent && (
                        <AlarmClock
                          className="mt-0.5 size-3 shrink-0"
                          style={{ color: accentVar("red") }}
                          aria-label="Urgent"
                        />
                      )}
                      {dueToday && (
                        <span
                          aria-hidden
                          className="mt-1 size-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: accentVar("green") }}
                          title="Due today"
                        />
                      )}
                    </button>
                    {(recurs || t.time) && !isExpanded && (
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        {recurs ? RECURRENCE_LABELS[t.recurrence!] : ""}
                        {recurs && t.time ? " · " : ""}
                        {t.time ?? ""}
                      </p>
                    )}
                    {isExpanded && (
                      <TaskSchedulePanel
                        task={t}
                        onChange={(patch) => updateTask(widget.id, t.id, patch)}
                        onDone={() => setExpanded(null)}
                      />
                    )}
                  </div>
                </div>
              </SwipeableListItem>
            </motion.li>
          );
        })}
        </ul>
      </SwipeRevealProvider>
    </>
  );
}

function RemindersContent({
  widget,
  filtersOpen,
  selectedFilters,
  onToggleFilter,
}: {
  widget: Widget;
  filtersOpen: boolean;
  selectedFilters: string[];
  onToggleFilter: (value: string) => void;
}) {
  const { updateReminder, setReminderStatus, deleteReminder, searchQuery } = useWorkspace();
  const [editing, setEditing] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  // Re-render every 30s so the "active alert" highlight appears the instant
  // the current time crosses a reminder's configured "Notify me" threshold.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  if (widget.content.kind !== "reminders") return null;
  const accent = accentVar(widget.accent);
  const showCompleted = selectedFilters.includes("completed");
  const items = widget.content.items
    .filter((r) => matchesQuery(r.title, searchQuery))
    .filter((r) => showCompleted || reminderState(r) !== "completed")
    .filter(
      (r) =>
        selectedFilters.length === 0 ||
        reminderFilterValues(r).some((v) => selectedFilters.includes(v)),
    )
    .map((r, index) => ({ r, index }))
    .sort((a, b) => {
      const aDone = reminderState(a.r) === "completed";
      const bDone = reminderState(b.r) === "completed";
      if (aDone !== bDone) return aDone ? 1 : -1;
      return a.index - b.index;
    })
    .map(({ r }) => r);

  return (
    <>
      <FilterChips
        options={REMINDER_FILTERS}
        selected={selectedFilters}
        onToggle={onToggleFilter}
        open={filtersOpen}
      />
      <SwipeRevealProvider>
        <ul className="space-y-2.5">
        {items.map((r) => {
          const done = reminderState(r) === "completed";
          const when = splitWhen(r);
          const isEditing = editing === r.id;
          const isRescheduling = rescheduling === r.id;
          const isConfirming = confirming === r.id;
          const isAlertActive = !done && isReminderAlertActive(r);
          return (
            <motion.li
              key={r.id}
              layout
              transition={{ type: "spring", stiffness: 500, damping: 40, mass: 0.6 }}
            >
              <SwipeableListItem
                id={r.id}
                actionsWidth={RAIL_W_2}
                className="rounded-lg"
                style={{
                  backgroundColor: isAlertActive
                    ? `color-mix(in srgb, ${accent} 12%, transparent)`
                    : "transparent",
                }}
                actions={
                  isConfirming ? (
                    <DeleteAction
                      label="Delete reminder"
                      confirming
                      onRequest={() => setConfirming(r.id)}
                      onCancel={() => setConfirming(null)}
                      onConfirm={() => {
                        setConfirming(null);
                        deleteReminder(widget.id, r.id);
                      }}
                    />
                  ) : (
                    <>
                      <MiniAction
                        label={r.flagged ? "Unflag reminder" : "Flag reminder"}
                        onClick={() => updateReminder(widget.id, r.id, { flagged: !r.flagged })}
                      >
                        <Flag
                          className={cn("size-3", r.flagged && "fill-current")}
                          style={r.flagged ? { color: accentVar("red") } : undefined}
                        />
                      </MiniAction>
                      <DeleteAction
                        label="Delete reminder"
                        confirming={false}
                        onRequest={() => setConfirming(r.id)}
                        onCancel={() => setConfirming(null)}
                        onConfirm={() => deleteReminder(widget.id, r.id)}
                      />
                    </>
                  )
                }
              >
                <div className="flex min-h-7 gap-2.5 pl-1.5 pr-1 py-0.5">
                  <button
                    type="button"
                    aria-label={done ? "Reopen reminder" : "Complete reminder"}
                    onPointerDown={stop}
                    onClick={(e) => {
                      e.stopPropagation();
                      setReminderStatus(widget.id, r.id, done ? "active" : "completed");
                    }}
                    className="mt-1 flex size-3.5 shrink-0 items-center justify-center rounded-full border transition-colors"
                    style={
                      done
                        ? { backgroundColor: accent, borderColor: accent }
                        : { borderColor: accent, backgroundColor: "transparent" }
                    }
                  >
                    {done && <Check className="size-2 text-white" strokeWidth={3} />}
                  </button>

                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="space-y-1.5" onClick={stop} onPointerDown={stop}>
                        <input
                          autoFocus
                          value={r.title}
                          onChange={(e) => updateReminder(widget.id, r.id, { title: e.target.value })}
                          className="w-full rounded-lg bg-surface-2 px-2 py-1 text-[13px] outline-none focus:ring-1 focus:ring-ring"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditing(null);
                          }}
                          className="label-xs hover:text-foreground"
                        >
                          Done
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(r.id);
                        }}
                        className="flex w-full min-w-0 items-start gap-1.5 text-left"
                      >
                        <p
                          className={cn(
                            "min-w-0 flex-1 truncate text-[13px] leading-snug",
                            done && "text-muted-foreground line-through",
                          )}
                        >
                          {highlightText(r.title, searchQuery)}
                        </p>
                        {r.flagged && (
                          <Flag
                            className="mt-0.5 size-3 shrink-0 fill-current"
                            style={{ color: accentVar("red") }}
                            aria-label="Flagged"
                          />
                        )}
                        {isAlertActive && (
                          <span
                            aria-hidden
                            className="mt-1 size-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: accent }}
                            title="Alert active"
                          />
                        )}
                      </button>
                    )}

                    {isRescheduling ? (
                      <div className="mt-1.5 space-y-1.5" onClick={stop} onPointerDown={stop}>
                        <div className="flex flex-col gap-1.5">
                          <DateField
                            size="sm"
                            value={when.date}
                            onChange={(iso) => updateReminder(widget.id, r.id, { date: iso })}
                            placeholder="Pick a date"
                            aria-label="Reminder date"
                          />
                          <TimeField
                            value={when.time}
                            onChange={(t) => updateReminder(widget.id, r.id, { time: t })}
                          />
                        </div>

                        <Select
                          value={String(r.notifyMinutesBefore ?? DEFAULT_NOTIFY_MINUTES)}
                          onValueChange={(v) =>
                            updateReminder(widget.id, r.id, { notifyMinutesBefore: Number(v) })
                          }
                        >
                          <SelectTrigger
                            aria-label="Notify me"
                            className="h-auto w-full rounded-xl border-border bg-surface px-2 py-1 text-[11px] shadow-none focus:ring-0 focus-visible:border-ring"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {NOTIFY_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={String(opt.value)} className="text-[12px]">
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRescheduling(null);
                          }}
                          className="label-xs hover:text-foreground"
                        >
                          Done
                        </button>
                      </div>
                    ) : (
                      formatReminderWhen(when) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRescheduling(r.id);
                          }}
                          className="block truncate font-mono text-[11px]"
                          style={{ color: `color-mix(in srgb, ${accent} 70%, var(--muted-foreground))` }}
                        >
                          {formatReminderWhen(when)}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </SwipeableListItem>
            </motion.li>
          );
        })}
        </ul>
      </SwipeRevealProvider>
    </>
  );
}

function ContactsContent({
  widget,
  filtersOpen,
  selectedFilters,
  onToggleFilter,
}: {
  widget: Widget;
  filtersOpen: boolean;
  selectedFilters: string[];
  onToggleFilter: (value: string) => void;
}) {
  const { updateContact, deleteContact, searchQuery } = useWorkspace();
  const [editingField, setEditingField] = useState<{
    id: string;
    field: "name" | "company" | "email" | "phone";
  } | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  if (widget.content.kind !== "contacts") return null;

  const fieldInputClass =
    "w-full rounded-md bg-surface px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-ring";

  /** Renders one contact field: a click-to-edit text button, or an inline
   * input while that specific field (and only that field) is being edited. */
  function EditableField({
    p,
    field,
    placeholder,
    className,
  }: {
    p: ContactItem;
    field: "name" | "company" | "email" | "phone";
    placeholder: string;
    className?: string;
  }) {
    const isEditing = editingField?.id === p.id && editingField.field === field;
    if (isEditing)
      return (
        <input
          autoFocus
          value={p[field] ?? ""}
          placeholder={placeholder}
          aria-label={placeholder}
          onClick={stop}
          onPointerDown={stop}
          onChange={(e) => updateContact(widget.id, p.id, { [field]: e.target.value })}
          onBlur={() => setEditingField(null)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setEditingField(null);
          }}
          className={cn(fieldInputClass, className)}
        />
      );
    const value = p[field];
    if (!value && field !== "name") return null;
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setEditingField({ id: p.id, field });
        }}
        className={cn("min-w-0 max-w-full truncate text-left", className)}
      >
        {highlightText(value ?? "", searchQuery)}
      </button>
    );
  }

  const visible = widget.content.items
    .filter((p) =>
      matchesQuery([p.name, p.company, p.email, p.phone].filter(Boolean).join(" "), searchQuery),
    )
    .filter(
      (p) => selectedFilters.length === 0 || selectedFilters.includes(contactFilterValue(p)),
    );

  return (
    <>
      <FilterChips
        options={CONTACT_FILTERS}
        selected={selectedFilters}
        onToggle={onToggleFilter}
        open={filtersOpen}
      />
      <SwipeRevealProvider>
        <ul className="grid grid-cols-1 gap-2.5 @[22rem]:grid-cols-2">
        {visible.map((p) => {
          const isConfirming = confirming === p.id;
          const category = contactFilterValue(p);
          const CategoryIcon =
            category === "hotel" ? Building2 : category === "agent" ? Users : UserRound;
          const categoryAccent =
            category === "hotel" ? "blue" : category === "agent" ? "purple" : "neutral";
          return (
            <li key={p.id} className="min-w-0">
              <SwipeableListItem
                id={p.id}
                actionsWidth={RAIL_W_2}
                actions={
                  isConfirming ? (
                    <DeleteAction
                      label="Delete contact"
                      confirming
                      onRequest={() => setConfirming(p.id)}
                      onCancel={() => setConfirming(null)}
                      onConfirm={() => {
                        setConfirming(null);
                        deleteContact(widget.id, p.id);
                      }}
                    />
                  ) : (
                    <>
                      <MiniAction
                        label={p.favorite ? "Unfavorite contact" : "Favorite contact"}
                        onClick={() => updateContact(widget.id, p.id, { favorite: !p.favorite })}
                      >
                        <Star
                          className={cn("size-3", p.favorite && "fill-current")}
                          style={p.favorite ? { color: accentVar("yellow") } : undefined}
                        />
                      </MiniAction>
                      <DeleteAction
                        label="Delete contact"
                        confirming={false}
                        onRequest={() => setConfirming(p.id)}
                        onCancel={() => setConfirming(null)}
                        onConfirm={() => deleteContact(widget.id, p.id)}
                      />
                    </>
                  )
                }
              >
                <div className="min-w-0 bg-surface-2 px-3 py-2">
                  <div className="flex items-start gap-1.5 pr-1">
                    {p.favorite && (
                      <Star
                        className="mt-0.5 size-3 shrink-0 fill-current"
                        style={{ color: accentVar("yellow") }}
                        aria-label="Favorite"
                      />
                    )}
                    <EditableField
                      p={p}
                      field="name"
                      placeholder="Name"
                      className="flex-1 text-[13px] font-medium"
                    />
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Category: ${category}`}
                          onClick={stop}
                          onPointerDown={stop}
                          className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-secondary"
                        >
                          <CategoryIcon
                            className="size-3"
                            style={{ color: accentVar(categoryAccent) }}
                          />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="end"
                        className="w-36 rounded-xl p-1"
                        onClick={stop}
                        onPointerDown={stop}
                      >
                        {(
                          [
                            ["hotel", "Hotel", Building2, "blue"],
                            ["agent", "Agent", Users, "purple"],
                            ["client", "Client", UserRound, "neutral"],
                          ] as const
                        ).map(([value, label, Icon, catAccent]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => updateContact(widget.id, p.id, { category: value as ContactCategory })}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] transition-colors hover:bg-secondary",
                              category === value && "bg-secondary/60",
                            )}
                          >
                            <Icon className="size-3.5" style={{ color: accentVar(catAccent) }} />
                            {label}
                          </button>
                        ))}
                      </PopoverContent>
                    </Popover>
                  </div>
                  <EditableField
                    p={p}
                    field="company"
                    placeholder="Company"
                    className="text-[11px] text-muted-foreground"
                  />
                  <EditableField
                    p={p}
                    field="email"
                    placeholder="Email"
                    className="text-[11px] text-entity-email"
                  />
                  <EditableField
                    p={p}
                    field="phone"
                    placeholder="Phone"
                    className="font-mono text-[11px] text-entity-phone"
                  />
                </div>
              </SwipeableListItem>
            </li>
          );
        })}
        </ul>
      </SwipeRevealProvider>
    </>
  );
}

/**
 * In-place rich-text editor for a sticky note. Uncontrolled (innerHTML is set
 * once on mount) so typing never resets the caret; changes stream to the
 * store on every input.
 */
function StickyNoteEditor({ widgetId, note }: { widgetId: string; note: NoteRefItem }) {
  const { updateNoteContent } = useWorkspace();
  return (
    <div
      ref={(el) => {
        if (el && !el.dataset["init"]) {
          el.innerHTML = note.text;
          el.dataset["init"] = "1";
        }
      }}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      aria-label="Edit sticky note"
      onInput={(e) => updateNoteContent(widgetId, note.id, e.currentTarget.innerHTML)}
      onPointerDown={stop}
      onDragStart={(e) => e.preventDefault()}
      className="notes-rich min-h-5 min-w-0 cursor-text break-words rounded-md text-[13px] leading-snug outline-none transition-colors focus:bg-surface/50"
    />
  );
}

function NotesContent({ widget }: { widget: Widget }) {
  const { convertNoteToSticky, deleteNote, toggleNotePin, searchQuery } = useWorkspace();
  const [confirming, setConfirming] = useState<string | null>(null);
  if (widget.content.kind !== "notes") return null;

  // Sticky notes render as a plain pastel note with click-to-edit content.
  if (widget.type === "sticky")
    return (
      <div className="space-y-2">
        {widget.content.items.map((n) => (
          <StickyNoteEditor key={n.id} widgetId={widget.id} note={n} />
        ))}
      </div>
    );

  const ordered = [...widget.content.items]
    .filter((n) => matchesQuery(n.text.replace(/<[^>]+>/g, " "), searchQuery))
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));

  if (ordered.length === 0)
    return (
      <p className="text-[12px] text-muted-foreground">
        {searchQuery.trim()
          ? "No notes match your search."
          : "Write in the NOTES editor and press save to add a note here."}
      </p>
    );

  return (
    <SwipeRevealProvider>
      <ul className="space-y-2">
        {ordered.map((n) => {
          const isConfirming = confirming === n.id;
          return (
            <li key={n.id} className="min-w-0">
              <SwipeableListItem
                id={n.id}
                actionsWidth={RAIL_W_3}
                actions={
                  isConfirming ? (
                    <DeleteAction
                      label="Delete note"
                      confirming
                      onRequest={() => setConfirming(n.id)}
                      onCancel={() => setConfirming(null)}
                      onConfirm={() => {
                        setConfirming(null);
                        deleteNote(widget.id, n.id);
                      }}
                    />
                  ) : (
                    <>
                      <MiniAction
                        label={n.pinned ? "Unpin note" : "Pin note"}
                        onClick={() => toggleNotePin(widget.id, n.id)}
                      >
                        <Pin className={cn("size-3", n.pinned && "fill-current")} />
                      </MiniAction>
                      <MiniAction
                        label="Convert to sticky note"
                        onClick={() => convertNoteToSticky(widget.id, n.id)}
                      >
                        <ArrowUpRight className="size-3" />
                      </MiniAction>
                      <DeleteAction
                        label="Delete note"
                        confirming={false}
                        onRequest={() => setConfirming(n.id)}
                        onCancel={() => setConfirming(null)}
                        onConfirm={() => deleteNote(widget.id, n.id)}
                      />
                    </>
                  )
                }
              >
                <div
                  className={cn(
                    "relative flex min-w-0 items-start gap-2 bg-surface-2 px-3 py-2",
                    n.pinned && "ring-1 ring-border",
                  )}
                >
                  <span
                    className="notes-rich min-w-0 flex-1 break-words text-[13px] leading-snug"
                    dangerouslySetInnerHTML={{
                      __html: highlightHtml(sanitizeHtml(n.text), searchQuery),
                    }}
                  />
                  {n.pinned && (
                    <Pin
                      className="pointer-events-none absolute right-2 top-2 size-3 text-muted-foreground/60"
                      fill="currentColor"
                    />
                  )}
                </div>
              </SwipeableListItem>
            </li>
          );
        })}
      </ul>
    </SwipeRevealProvider>
  );
}

/**
 * INFORMATION renders as a list of individually editable key/value rows,
 * matching the interaction pattern of NOTES: tap/hover reveals a contextual
 * action bar (pin, edit, convert to sticky note, delete) and the label/value
 * fields themselves are always live-editable, preserving the two-font table
 * look (uppercase muted label / monospace dark value).
 */
function InformationContent({ widget }: { widget: Widget }) {
  const {
    updateInformation,
    deleteInformation,
    convertInformationToSticky,
    addInformation,
    searchQuery,
  } = useWorkspace();
  const [confirming, setConfirming] = useState<string | null>(null);
  if (widget.content.kind !== "information") return null;

  const ordered = [...widget.content.items]
    .filter((i) => matchesQuery(`${i.label} ${i.value}`, searchQuery))
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));

  return (
    <div className="space-y-2">
      {ordered.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">
          {searchQuery.trim() ? "No details match your search." : "No details yet."}
        </p>
      ) : (
        <SwipeRevealProvider>
          <ul className="overflow-hidden rounded-xl bg-surface-2">
            {ordered.map((i) => {
              const isConfirming = confirming === i.id;
              return (
                <li key={i.id} className="border-b border-border/60 last:border-b-0">
                  <SwipeableListItem
                    id={i.id}
                    actionsWidth={RAIL_W_2}
                    className="rounded-none"
                    actions={
                      isConfirming ? (
                        <DeleteAction
                          label="Delete detail"
                          confirming
                          onRequest={() => setConfirming(i.id)}
                          onCancel={() => setConfirming(null)}
                          onConfirm={() => {
                            setConfirming(null);
                            deleteInformation(widget.id, i.id);
                          }}
                        />
                      ) : (
                        <>
                          <MiniAction
                            label="Convert to sticky note"
                            onClick={() => convertInformationToSticky(widget.id, i.id)}
                          >
                            <ArrowUpRight className="size-3" />
                          </MiniAction>
                          <DeleteAction
                            label="Delete detail"
                            confirming={false}
                            onRequest={() => setConfirming(i.id)}
                            onCancel={() => setConfirming(null)}
                            onConfirm={() => deleteInformation(widget.id, i.id)}
                          />
                        </>
                      )
                    }
                  >
                    <div
                      className={cn(
                        "flex items-center gap-3 px-3 py-1.5",
                        i.pinned && "bg-surface",
                      )}
                    >
                      <input
                        value={i.label}
                        aria-label="Label"
                        placeholder="LABEL"
                        onClick={stop}
                        onPointerDown={stop}
                        onChange={(e) => updateInformation(widget.id, i.id, { label: e.target.value })}
                        className="label-xs w-24 shrink-0 truncate bg-transparent outline-none focus:ring-1 focus:ring-ring rounded-md px-1 -mx-1"
                      />
                      <input
                        value={i.value}
                        aria-label="Value"
                        placeholder="Value"
                        onClick={stop}
                        onPointerDown={stop}
                        onChange={(e) => updateInformation(widget.id, i.id, { value: e.target.value })}
                        className="min-w-0 flex-1 truncate rounded-md bg-transparent px-1 -mx-1 text-right font-mono text-[12.5px] text-foreground outline-none focus:ring-1 focus:ring-ring"
                      />
                      {i.pinned && (
                        <Pin
                          className="pointer-events-none size-3 shrink-0 text-muted-foreground/60"
                          fill="currentColor"
                        />
                      )}
                    </div>
                  </SwipeableListItem>
                </li>
              );
            })}
          </ul>
        </SwipeRevealProvider>
      )}
      <button
        type="button"
        onClick={() => addInformation(widget.id)}
        className="label-xs flex items-center gap-1 rounded-md px-1 py-0.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        <Plus className="size-3" /> Add detail
      </button>
    </div>
  );
}

/**
 * DAILY STATISTICS renders a compact table of call counts — properties
 * (AR/ER/RI) as rows, action hashtags as columns — for a single day, sourced
 * live from the isolated `callHistory` log (never from the Notes widget).
 */
function StatsContent({ widget }: { widget: Widget }) {
  const { callHistory } = useWorkspace();
  const [day, setDay] = useState(todayISO());
  if (widget.content.kind !== "stats") return null;

  // Compare on the LOCAL calendar date of each call, not the raw UTC prefix of
  // `savedAtISO`. `day` comes from `todayISO()` (local), so slicing the UTC
  // string would drop evening calls in behind-UTC timezones (e.g. Panama).
  const dayEntries = useMemo(
    () => callHistory.filter((c) => localISODate(new Date(c.savedAtISO)) === day),
    [callHistory, day],
  );

  const rows = (["AR", "ER", "RI"] as const).map((code) => {
    const rowEntries = dayEntries.filter((c) => c.property === code);
    const cells = CALL_HASHTAGS.map(
      (tag) => rowEntries.filter((c) => c.hashtags.includes(tag)).length,
    );
    return { code, cells, total: rowEntries.length };
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-3" onClick={stop}>
      <div className="flex items-center justify-between gap-2">
        <DateField
          value={day}
          onChange={setDay}
          size="sm"
          aria-label="Statistics day"
          className="w-auto"
        />
        <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
          Total calls: <span className="font-mono text-foreground">{dayEntries.length}</span>
        </span>
      </div>

      {callHistory.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">
          Calls finished from the Notes tool will appear here.
        </p>
      ) : (
        <div className="hover-scroll flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
          {rows.map((row) => {
            const style = PROPERTY_STYLES[row.code];
            return (
              <div
                key={row.code}
                className="flex flex-col gap-1.5 rounded-xl border border-border/60 bg-surface-2/50 p-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="min-w-0 truncate rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                    style={{ backgroundColor: style.hex, color: style.fg }}
                  >
                    {style.label}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] font-semibold text-foreground">
                    {row.total}
                  </span>
                </div>
                {row.total > 0 ? (
                  <div className="flex flex-wrap items-center gap-1">
                    {CALL_HASHTAGS.map((tag, i) => {
                      const n = row.cells[i];
                      if (!n) return null;
                      return (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                          style={{ backgroundColor: `${style.hex}26`, color: style.hex }}
                        >
                          {tag.slice(1)}
                          <span className="font-mono font-semibold">{n}</span>
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[10.5px] text-muted-foreground/70">No calls yet</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function WidgetContent({
  widget,
  filtersOpen = false,
  selectedFilters = [],
  onToggleFilter = () => {},
}: {
  widget: Widget;
  filtersOpen?: boolean;
  selectedFilters?: string[];
  onToggleFilter?: (value: string) => void;
}) {
  const c = widget.content;

  if (c.kind === "reminders")
    return (
      <RemindersContent
        widget={widget}
        filtersOpen={filtersOpen}
        selectedFilters={selectedFilters}
        onToggleFilter={onToggleFilter}
      />
    );
  if (c.kind === "tasks")
    return (
      <TasksContent
        widget={widget}
        filtersOpen={filtersOpen}
        selectedFilters={selectedFilters}
        onToggleFilter={onToggleFilter}
      />
    );
  if (c.kind === "contacts")
    return (
      <ContactsContent
        widget={widget}
        filtersOpen={filtersOpen}
        selectedFilters={selectedFilters}
        onToggleFilter={onToggleFilter}
      />
    );
  if (c.kind === "information") return <InformationContent widget={widget} />;
  if (c.kind === "stats") return <StatsContent widget={widget} />;

  return <NotesContent widget={widget} />;
}

/** Widget kinds that expose a filter-chip row and therefore the header toggle. */
export function widgetSupportsFilters(kind: Widget["content"]["kind"]): boolean {
  return kind === "reminders" || kind === "tasks" || kind === "contacts";
}
