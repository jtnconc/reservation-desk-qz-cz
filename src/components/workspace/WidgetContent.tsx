import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Check, Clock, Pencil, Pin, Repeat, Trash2, X } from "lucide-react";
import { useWorkspace } from "@/workspace/store";
import type { ItemStatus, NoteRefItem, ReminderItem, TaskItem, Widget } from "@/workspace/types";
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

import { accentVar } from "./AccentControl";

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

/**
 * Wrapper that reveals contextual actions on hover, or on tap (touch).
 * Actions are absolutely positioned over the item's trailing edge with a soft
 * fade so compact cards never get their content clipped or pushed around.
 */
function ItemActions({
  revealed,
  children,
}: {
  revealed: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute right-0 top-0 z-10 flex shrink-0 items-start gap-0.5 rounded-lg pl-2 backdrop-blur-[3px] transition-opacity duration-200",
        revealed
          ? "pointer-events-auto opacity-100"
          : "opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100",
      )}
    >
      {children}
    </span>
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

function TasksContent({ widget }: { widget: Widget }) {
  const { toggleTask, updateTask, deleteTask, searchQuery } = useWorkspace();
  const [tapped, setTapped] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  if (widget.content.kind !== "tasks") return null;
  const items = widget.content.items.filter((t) => matchesQuery(t.title, searchQuery));
  const accent = accentVar(widget.accent);

  return (
    <ul className="space-y-2">
      {items.map((t) => {
        const done = taskState(t.status) === "completed";
        const isConfirming = confirming === t.id;
        const isScheduling = scheduling === t.id;
        const recurs = !!t.recurrence && t.recurrence !== "none";
        const dueToday = !done && isTaskDueToday(t);
        return (
          <li
            key={t.id}
            className="group relative flex min-h-6 items-start gap-2 pr-1"
            onClick={() => setTapped((v) => (v === t.id ? null : t.id))}
          >
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
              <div className="flex items-start gap-1.5">
                <span
                  className={cn(
                    "min-w-0 flex-1 break-words text-[13px] leading-snug",
                    done && "text-muted-foreground line-through",
                  )}
                >
                  {highlightText(t.title, searchQuery)}
                </span>
                {dueToday && (
                  <span
                    aria-hidden
                    className="mt-1 size-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: accentVar("green") }}
                    title="Due today"
                  />
                )}
              </div>
              {(recurs || t.time) && !isScheduling && (
                <p className="truncate font-mono text-[11px] text-muted-foreground">
                  {recurs ? RECURRENCE_LABELS[t.recurrence!] : ""}
                  {recurs && t.time ? " · " : ""}
                  {t.time ?? ""}
                </p>
              )}
              {isScheduling && (
                <TaskSchedulePanel
                  task={t}
                  onChange={(patch) => updateTask(widget.id, t.id, patch)}
                  onDone={() => setScheduling(null)}
                />
              )}
            </div>
            <ItemActions revealed={tapped === t.id || isConfirming || isScheduling}>
              {isConfirming ? (
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
                  <MiniAction label="Repeat & schedule task" onClick={() => setScheduling(t.id)}>
                    <Repeat className="size-3" />
                  </MiniAction>
                  <DeleteAction
                    label="Delete task"
                    confirming={false}
                    onRequest={() => setConfirming(t.id)}
                    onCancel={() => setConfirming(null)}
                    onConfirm={() => deleteTask(widget.id, t.id)}
                  />
                </>
              )}
            </ItemActions>
          </li>
        );
      })}
    </ul>
  );
}

function RemindersContent({ widget }: { widget: Widget }) {
  const { updateReminder, setReminderStatus, deleteReminder, searchQuery } = useWorkspace();
  const [editing, setEditing] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const [tapped, setTapped] = useState<string | null>(null);
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
  const items = widget.content.items.filter((r) => matchesQuery(r.title, searchQuery));

  return (
    <ul className="space-y-2.5">
      {items.map((r) => {
        const done = reminderState(r) === "completed";
        const when = splitWhen(r);
        const isEditing = editing === r.id;
        const isRescheduling = rescheduling === r.id;
        const isConfirming = confirming === r.id;
        const isAlertActive = !done && isReminderAlertActive(r);
        return (
          <li
            key={r.id}
            className={cn(
              "group relative flex min-h-7 gap-2.5 rounded-lg border border-transparent pr-1 pl-1.5 transition-colors",
              isAlertActive && "border",
            )}
            style={
              isAlertActive
                ? { backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)`, borderColor: accent }
                : undefined
            }
            onClick={() => setTapped((v) => (v === r.id ? null : r.id))}
          >
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

            <div className="min-w-0 flex-1 py-0.5">
              {isEditing ? (
                <div className="space-y-1.5" onClick={stop} onPointerDown={stop}>
                  <input
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
                <div className="flex items-start gap-1.5">
                  <p
                    className={cn(
                      "min-w-0 flex-1 truncate text-[13px] leading-snug",
                      done && "text-muted-foreground line-through",
                    )}
                  >
                    {highlightText(r.title, searchQuery)}
                  </p>
                  {isAlertActive && (
                    <span
                      aria-hidden
                      className="mt-1 size-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: accent }}
                      title="Alert active"
                    />
                  )}
                </div>
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
                <p className="truncate font-mono text-[11px] text-muted-foreground">
                  {[when.date, when.time].filter(Boolean).join(" ") || "No date"}
                </p>
              )}
            </div>

            <ItemActions
              revealed={tapped === r.id || isEditing || isRescheduling || isConfirming}
            >
              {isConfirming ? (
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
                  <MiniAction label="Edit reminder" onClick={() => setEditing(r.id)}>
                    <Pencil className="size-3" />
                  </MiniAction>
                  <MiniAction label="Reschedule reminder" onClick={() => setRescheduling(r.id)}>
                    <Clock className="size-3" />
                  </MiniAction>
                  <DeleteAction
                    label="Delete reminder"
                    confirming={false}
                    onRequest={() => setConfirming(r.id)}
                    onCancel={() => setConfirming(null)}
                    onConfirm={() => deleteReminder(widget.id, r.id)}
                  />
                </>
              )}
            </ItemActions>
          </li>
        );
      })}
    </ul>
  );
}

function ContactsContent({ widget }: { widget: Widget }) {
  const { updateContact, deleteContact, searchQuery } = useWorkspace();
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [tapped, setTapped] = useState<string | null>(null);
  if (widget.content.kind !== "contacts") return null;

  const field =
    "w-full rounded-lg bg-surface px-2 py-1 text-[12px] outline-none focus:ring-1 focus:ring-ring";

  const visible = widget.content.items.filter((p) =>
    matchesQuery([p.name, p.company, p.email, p.phone].filter(Boolean).join(" "), searchQuery),
  );

  return (
    <ul className="grid grid-cols-1 gap-2.5 @[22rem]:grid-cols-2">
      {visible.map((p) => {
        const isEditing = editing === p.id;
        const isConfirming = confirming === p.id;
        return (
          <li
            key={p.id}
            className="group relative min-w-0 rounded-xl bg-surface-2 px-3 py-2"
            onClick={() => setTapped((v) => (v === p.id ? null : p.id))}
          >
            <div className="flex min-w-0 items-start gap-2">
              <div className="min-w-0 flex-1">
                {isEditing ? (
                  <div className="space-y-1" onClick={stop} onPointerDown={stop}>
                    {(
                      [
                        ["name", "Name"],
                        ["company", "Company"],
                        ["email", "Email"],
                        ["phone", "Phone"],
                      ] as const
                    ).map(([key, label]) => (
                      <input
                        key={key}
                        value={p[key] ?? ""}
                        placeholder={label}
                        aria-label={label}
                        onChange={(e) => updateContact(widget.id, p.id, { [key]: e.target.value })}
                        className={field}
                      />
                    ))}
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
                  <>
                    <p className="truncate pr-6 text-[13px] font-medium">
                      {highlightText(p.name, searchQuery)}
                    </p>
                    {p.company && (
                      <p className="truncate text-[11px] text-muted-foreground">
                        {highlightText(p.company, searchQuery)}
                      </p>
                    )}
                    {p.email && (
                      <p className="truncate text-[11px] text-entity-email">
                        {highlightText(p.email, searchQuery)}
                      </p>
                    )}
                    {p.phone && (
                      <p className="truncate font-mono text-[11px] text-entity-phone">
                        {highlightText(p.phone, searchQuery)}
                      </p>
                    )}
                  </>
                )}
              </div>

              <ItemActions revealed={tapped === p.id || isEditing || isConfirming}>
                {isConfirming ? (
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
                    <MiniAction label="Edit contact" onClick={() => setEditing(p.id)}>
                      <Pencil className="size-3" />
                    </MiniAction>
                    <DeleteAction
                      label="Delete contact"
                      confirming={false}
                      onRequest={() => setConfirming(p.id)}
                      onCancel={() => setConfirming(null)}
                      onConfirm={() => deleteContact(widget.id, p.id)}
                    />
                  </>
                )}
              </ItemActions>
            </div>
          </li>
        );
      })}
    </ul>
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
  const { convertNoteToSticky, deleteNote, toggleNotePin, editNoteInEditor, searchQuery } =
    useWorkspace();
  const [tapped, setTapped] = useState<string | null>(null);
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
    <ul className="space-y-2">
      {ordered.map((n) => {
        const isConfirming = confirming === n.id;
        return (
          <li
            key={n.id}
            className={cn(
              "group relative flex min-w-0 items-start gap-2 rounded-xl bg-surface-2 px-3 py-2",
              n.pinned && "ring-1 ring-border",
            )}
            onClick={() => setTapped((v) => (v === n.id ? null : n.id))}
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
            <ItemActions revealed={tapped === n.id || isConfirming}>
              {isConfirming ? (
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
                    <Pin className="size-3" />
                  </MiniAction>
                  <MiniAction
                    label="Edit note"
                    onClick={() => editNoteInEditor(widget.id, n.id)}
                  >
                    <Pencil className="size-3" />
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
              )}
            </ItemActions>
          </li>
        );
      })}
    </ul>
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
  const { updateInformation, deleteInformation, toggleInformationPin, convertInformationToSticky, searchQuery } =
    useWorkspace();
  const [tapped, setTapped] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const valueRefs = useRef<Record<string, HTMLInputElement | null>>({});
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
        <ul className="divide-y divide-border/60 overflow-hidden rounded-xl bg-surface-2">
          {ordered.map((i) => {
            const isConfirming = confirming === i.id;
            return (
              <li
                key={i.id}
                className={cn(
                  "group relative flex items-center gap-3 px-3 py-1.5",
                  i.pinned && "bg-surface",
                )}
                onClick={() => setTapped((v) => (v === i.id ? null : i.id))}
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
                  ref={(el) => {
                    valueRefs.current[i.id] = el;
                  }}
                  value={i.value}
                  aria-label="Value"
                  placeholder="Value"
                  onClick={stop}
                  onPointerDown={stop}
                  onChange={(e) => updateInformation(widget.id, i.id, { value: e.target.value })}
                  className="min-w-0 flex-1 truncate rounded-md bg-transparent px-1 -mx-1 text-right font-mono text-[12.5px] text-foreground outline-none focus:ring-1 focus:ring-ring"
                />
                {i.pinned && !isConfirming && (
                  <Pin className="pointer-events-none size-3 shrink-0 text-muted-foreground/60" fill="currentColor" />
                )}
                <ItemActions revealed={tapped === i.id || isConfirming}>
                  {isConfirming ? (
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
                        label={i.pinned ? "Unpin detail" : "Pin detail"}
                        onClick={() => toggleInformationPin(widget.id, i.id)}
                      >
                        <Pin className="size-3" />
                      </MiniAction>
                      <MiniAction
                        label="Edit detail"
                        onClick={() => valueRefs.current[i.id]?.focus()}
                      >
                        <Pencil className="size-3" />
                      </MiniAction>
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
                  )}
                </ItemActions>
              </li>
            );
          })}
        </ul>
      )}
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
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
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

export function WidgetContent({ widget }: { widget: Widget }) {
  const c = widget.content;

  if (c.kind === "reminders") return <RemindersContent widget={widget} />;
  if (c.kind === "tasks") return <TasksContent widget={widget} />;
  if (c.kind === "contacts") return <ContactsContent widget={widget} />;
  if (c.kind === "information") return <InformationContent widget={widget} />;
  if (c.kind === "stats") return <StatsContent widget={widget} />;

  return <NotesContent widget={widget} />;
}
