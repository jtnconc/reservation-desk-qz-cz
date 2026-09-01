import { useEffect, useRef, useState } from "react";
import { Undo2 } from "lucide-react";
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

/** Max height (px) a single grid row is allowed to grow to before content
 * must scroll internally instead of stretching the whole row/dashboard. */
const ROW_MAX_HEIGHT = 320;

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
      <div className="flex w-full min-w-0 flex-row flex-nowrap gap-2 overflow-x-auto whitespace-nowrap">
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
                <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1.5 py-[1px] text-[10px] font-semibold text-primary-foreground">
                  +{pulse}
                </span>
              ) : badgeColor ? (
                <span
                  aria-label="Due today"
                  title="Due today"
                  className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full ring-2 ring-surface"
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
    <div className="grid auto-rows-[minmax(140px,auto)] grid-cols-2 gap-3 sm:grid-cols-4">
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
              minHeight: w.height === 2 ? "292px" : "140px",
              ...(isLocked
                ? { maxHeight: lockedHeight ? `${lockedHeight}px` : `${ROW_MAX_HEIGHT}px` }
                : { maxHeight: `${ROW_MAX_HEIGHT * w.height}px` }),
            }}
            className={cn(
              "desk-panel relative flex cursor-grab flex-col self-start overflow-hidden p-4 transition-all duration-300 active:cursor-grabbing",
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
                {isSticky && (
                  <button
                    type="button"
                    aria-label="Return note to Notes"
                    title="Return note to Notes"
                    onPointerDown={(e) => e.stopPropagation()}
                    onDragStart={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.stopPropagation();
                      returnStickyToNotes(w.id);
                    }}
                    className="flex size-5 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <Undo2 className="size-3" />
                  </button>
                )}
                <SizeControl
                  value={`${w.width}x${w.height}` as WidgetSize}
                  onChange={(s) => setWidgetSize(w.id, s)}
                  locked={isLocked}
                  onToggleLock={() => handleToggleLock(w.id)}
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
