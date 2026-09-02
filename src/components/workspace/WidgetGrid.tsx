import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useWorkspace } from "@/workspace/store";
import type { Widget, WidgetSize } from "@/workspace/types";
import { cn } from "@/lib/utils";
import { todayISO } from "@/lib/quote-model";
import { isTaskDueToday } from "@/lib/task-schedule";
import { WidgetContent } from "./WidgetContent";
import { SizeControl } from "./SizeControl";
import { accentVar, tintVar } from "./AccentControl";
import { WidgetCustomizer } from "./WidgetCustomizer";
import { widgetIcon } from "./widget-icons";

/** Fixed height (px) of a single grid track row. Cards span an exact number
 * of these rows (1 or 2) and never grow past their span — inner content that
 * overflows scrolls instead of stretching the row/dashboard. */
const ROW_UNIT = 150;
/** Vertical gap (px) between grid rows; must match the `gap-3` utility (0.75rem). */
const ROW_GAP = 12;

/** Fixed outer height (px) for a card spanning `h` grid rows, including the
 * inter-row gap that a 2-row card absorbs. */
const cardHeight = (h: number) => h * ROW_UNIT + (h - 1) * ROW_GAP;

/** True when a widget has something actionable due "now" that should surface
 * a small colored dot on its minimized pill, even while collapsed. */
function dueBadgeColor(w: Widget): string | null {
  if (w.content.kind === "reminders") {
    const today = todayISO();
    const due = w.content.items.some(
      (r) => (r.status ?? (r.done ? "completed" : "active")) === "active" && r.date === today,
    );
    return due ? accentVar("orange") : null;
  }
  if (w.content.kind === "tasks") {
    const due = w.content.items.some((t) => {
      const done = t.status === "done" || t.status === "completed";
      return !done && isTaskDueToday(t);
    });
    return due ? accentVar("green") : null;
  }
  return null;
}

const spanClass = (w: Widget) =>
  cn(
    w.width === 2 ? "sm:col-span-2" : "col-span-1",
    w.height === 2 ? "row-span-2" : "row-span-1",
  );

export function WidgetGrid() {
  const {
    widgets,
    mode,
    activeWidget,
    openWidget,
    setWidgetSize,
    setWidgetAccent,
    setWidgetIcon,
    setWidgetTint,
    renameWidget,
    returnStickyToNotes,
    reorderWidgets,
    toggleWidgetHeightLock,
    addInformation,
    pulses,
    clearPulse,
  } = useWorkspace();
  const ordered = [...widgets].sort((a, b) => a.position - b.position);
  const minimized = mode === "tool";

  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [settling, setSettling] = useState<string | null>(null);
  const [customizing, setCustomizing] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [lockedHeights, setLockedHeights] = useState<Record<string, number>>({});
  const dragged = useRef<string | null>(null);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

  const handleToggleLock = (id: string) => {
    const el = sectionRefs.current.get(id);
    const isCurrentlyLocked = widgets.find((w) => w.id === id)?.heightLocked;
    if (!isCurrentlyLocked && el) {
      setLockedHeights((prev) => ({ ...prev, [id]: el.getBoundingClientRect().height }));
    }
    toggleWidgetHeightLock(id);
  };

  useEffect(() => {
    if (!settling) return;
    const t = setTimeout(() => setSettling(null), 340);
    return () => clearTimeout(t);
  }, [settling]);

  // Auto-clear the temporary "+n" notification badges.
  const pulseIds = Object.keys(pulses);
  useEffect(() => {
    if (pulseIds.length === 0) return;
    const timers = pulseIds.map((id) => setTimeout(() => clearPulse(id), 4000));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulseIds.join(","), clearPulse]);

  const activate = (id: string) => {
    setSettling(id);
    openWidget(id);
  };

  if (minimized)
    return (
      // Horizontal scroll needs overflow-x-auto, but per the CSS overflow
      // spec any non-visible x/y pairing forces the *other* axis to auto
      // too — so overflow-x-auto alone silently clips a badge that sits
      // outside a pill's edge. Reserve room with padding and keep each
      // badge's center on the pill's corner (translate by half its own
      // size) so it always renders inside this scrollable box.
      <div className="flex w-full min-w-0 flex-row flex-nowrap gap-2 overflow-x-auto whitespace-nowrap p-1 pt-2">
        {ordered.map((w) => {
          const Icon = widgetIcon(w.type, w.icon);
          const pulse = pulses[w.id];
          const badgeColor = dueBadgeColor(w);
          return (
            <button
              key={w.id}
              onClick={() => activate(w.id)}
              className={cn(
                "group relative flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-2 shadow-desk transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift",
                pulse && "widget-glow",
              )}
              style={w.type === "sticky" ? { backgroundColor: tintVar(w.tint) } : undefined}
            >
              <Icon
                className="size-[15px] transition-colors"
                style={{ color: accentVar(w.accent) }}
              />
              <span className="label-xs group-hover:text-foreground">{w.title}</span>
              {pulse ? (
                <span className="absolute right-0 top-0 z-10 -translate-y-1/2 translate-x-1/2 rounded-full bg-primary px-1.5 py-[1px] text-[10px] font-semibold text-primary-foreground">
                  +{pulse}
                </span>
              ) : badgeColor ? (
                <span
                  aria-label="Due today"
                  title="Due today"
                  className="absolute right-0 top-0 z-10 size-2.5 -translate-y-1/2 translate-x-1/2 rounded-full ring-2 ring-surface"
                  style={{ backgroundColor: badgeColor }}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    );

  const handleEnter = (targetId: string) => {
    const id = dragged.current;
    if (!id || id === targetId) return;
    setOverId(targetId);
    const target = ordered.findIndex((x) => x.id === targetId);
    if (target >= 0) reorderWidgets(id, target);
  };

  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      style={{ gridAutoRows: `${ROW_UNIT}px` }}
    >
      {ordered.map((w) => {
        const Icon = widgetIcon(w.type, w.icon);
        const active = activeWidget === w.id;
        const isDragging = dragId === w.id;
        const accent = accentVar(w.accent);
        const isSticky = w.type === "sticky";
        const isCustomizing = customizing === w.id && isSticky;
        const pulse = pulses[w.id];
        const isLocked = !!w.heightLocked;
        const lockedHeight = lockedHeights[w.id];
        return (
          <section
            key={w.id}
            ref={(el) => {
              if (el) sectionRefs.current.set(w.id, el);
              else sectionRefs.current.delete(w.id);
            }}
            draggable
            onDragStart={(e) => {
              dragged.current = w.id;
              setDragId(w.id);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", w.id);
            }}
            onDragEnd={() => {
              dragged.current = null;
              setDragId(null);
              setOverId(null);
            }}
            onDragEnter={() => handleEnter(w.id)}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              dragged.current = null;
              setDragId(null);
              setOverId(null);
            }}
            onClick={() => activate(w.id)}
            style={{
              ...(isSticky ? { backgroundColor: tintVar(w.tint) } : {}),
              ...(active
                ? { borderColor: `color-mix(in oklch, ${accent} 35%, transparent)` }
                : {}),
              // Rigid grid unit: the card is locked to the exact height of its
              // row span so content can never alter the track height. Overflow
              // is handled by the inner scroll container below.
              height: isLocked && lockedHeight ? `${lockedHeight}px` : `${cardHeight(w.height)}px`,
            }}
            className={cn(
              "desk-panel relative flex cursor-grab flex-col overflow-hidden p-4 transition-all duration-300 active:cursor-grabbing",
              spanClass(w),
              active ? "shadow-lift" : "hover:shadow-lift",
              isDragging && "scale-[0.98] opacity-40",
              overId === w.id && !isDragging && "ring-2 ring-ring/60",
              settling === w.id && "widget-settle",
              pulse && "widget-glow",
            )}
          >
            {pulse ? (
              <span className="absolute right-2 top-2 z-10 rounded-full bg-primary px-1.5 py-[1px] text-[10px] font-semibold text-primary-foreground">
                +{pulse}
              </span>
            ) : null}
            <header className="mb-3 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                {isSticky ? (
                  <button
                    type="button"
                    aria-label="Customize sticky note"
                    title="Customize sticky note"
                    onPointerDown={(e) => e.stopPropagation()}
                    onDragStart={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCustomizing((v) => (v === w.id ? null : w.id));
                    }}
                    className="flex size-5 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-secondary"
                  >
                    <Icon className="size-[15px]" style={{ color: accent }} />
                  </button>
                ) : (
                  <span className="flex size-5 shrink-0 items-center justify-center">
                    <Icon className="size-[15px]" style={{ color: accent }} />
                  </span>
                )}
                {isSticky ? (
                  editingTitle === w.id ? (
                    <input
                      autoFocus
                      defaultValue={w.title}
                      aria-label="Sticky note title"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      onDragStart={(e) => e.preventDefault()}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v) renameWidget(w.id, v);
                        setEditingTitle(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") setEditingTitle(null);
                      }}
                      className="label-xs w-28 min-w-0 rounded-md bg-surface px-1.5 py-0.5 outline-none ring-1 ring-ring/50"
                    />
                  ) : (
                    <button
                      type="button"
                      title="Rename sticky note"
                      onPointerDown={(e) => e.stopPropagation()}
                      onDragStart={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTitle(w.id);
                      }}
                      className="label-xs truncate rounded-md px-1 transition-colors hover:bg-secondary/70"
                    >
                      {w.title}
                    </button>
                  )
                ) : (
                  <h3 className="label-xs truncate">{w.title}</h3>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {w.content.kind === "information" && (
                  <button
                    type="button"
                    aria-label="Add detail"
                    title="Add detail"
                    onPointerDown={(e) => e.stopPropagation()}
                    onDragStart={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.stopPropagation();
                      addInformation(w.id);
                    }}
                    className="flex size-5 items-center justify-center rounded-md opacity-50 transition-opacity duration-200 ease-out hover:bg-secondary hover:opacity-100"
                  >
                    <Plus className="size-[15px]" />
                  </button>
                )}
                <SizeControl
                  value={`${w.width}x${w.height}` as WidgetSize}
                  onChange={(s) => setWidgetSize(w.id, s)}
                  locked={isLocked}
                  onToggleLock={() => handleToggleLock(w.id)}
                  onReturn={isSticky ? () => returnStickyToNotes(w.id) : undefined}
                  returnLabel={
                    w.content.kind === "information"
                      ? "Return detail to Information list"
                      : "Return note to Notes list"
                  }
                />
              </div>
            </header>
            {isCustomizing && (
              <WidgetCustomizer
                icon={w.icon}
                accent={w.accent}
                tint={w.tint}
                onIcon={(icon) => setWidgetIcon(w.id, icon)}
                onAccent={(a) => setWidgetAccent(w.id, a)}
                onTint={(t) => setWidgetTint(w.id, t)}
              />
            )}
            <div className="@container min-h-0 flex-1 overflow-y-auto">
              <WidgetContent widget={w} />
            </div>
          </section>
        );
      })}
    </div>
  );
}
