import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { History, PhoneOff, Save } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/workspace/store";
import {
  ENTITY_STYLES,
  extractContact,
  extractReminder,
  parseEntities,
} from "@/lib/note-parser";
import {
  CALL_HASHTAGS,
  findActivePropertyCode,
  PROPERTY_STYLES,
} from "@/lib/property-codes";
import { cn } from "@/lib/utils";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { registerNotesEditor } from "./notes-format";
import { CallHistoryPanel } from "./CallHistoryPanel";

const HIGHLIGHT_PREFIX = "entity-";


export function NotesTool() {
  const {
    noteText,
    setNoteText,
    callHistory,
    saveNoteToWidget,
    finishCall,
    addReminder,
    addContact,
  } = useWorkspace();
  const editorRef = useRef<HTMLDivElement>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [plain, setPlain] = useState("");
  // Toggled action hashtags for the active call — kept purely as UI state,
  // never injected into the note text itself.
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const toggleTag = (tag: string) =>
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });

  // Keep the DOM in sync only when the incoming value differs (restore/version).
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (el.innerHTML !== noteText) el.innerHTML = noteText;
    setPlain(el.textContent ?? "");
  }, [noteText]);

  useEffect(() => {
    registerNotesEditor(editorRef.current);
    return () => registerNotesEditor(null);
  }, []);

  const entities = useMemo(() => parseEntities(plain), [plain]);
  const activeProperty = useMemo(() => findActivePropertyCode(plain), [plain]);
  const activePropertyStyle = activeProperty
    ? PROPERTY_STYLES[activeProperty.code]
    : null;

  // Clear toggled hashtags whenever the active property code changes (or
  // disappears), so tags never carry over between unrelated calls.
  useEffect(() => {
    setActiveTags(new Set());
  }, [activeProperty?.code]);

  /** Paint entity + property-code highlights with the CSS Custom Highlight API (no overlay → caret stays exact). */
  const paintHighlights = useCallback(() => {
    const el = editorRef.current;
    const highlights = (
      CSS as unknown as { highlights?: Map<string, unknown> }
    ).highlights;
    if (!el || !highlights || typeof Highlight === "undefined") return;

    for (const key of Object.keys(ENTITY_STYLES))
      highlights.delete(HIGHLIGHT_PREFIX + key);
    for (const style of Object.values(PROPERTY_STYLES))
      highlights.delete(style.highlightKey);

    // Flatten text nodes with their global offsets.
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes: { node: Text; start: number }[] = [];
    let offset = 0;
    let n = walker.nextNode() as Text | null;
    while (n) {
      nodes.push({ node: n, start: offset });
      offset += n.data.length;
      n = walker.nextNode() as Text | null;
    }

    const rangeFor = (start: number, end: number): Range | null => {
      const range = document.createRange();
      let placedStart = false;
      let placedEnd = false;
      for (const { node, start: nodeStart } of nodes) {
        const nodeEnd = nodeStart + node.data.length;
        if (!placedStart && start >= nodeStart && start <= nodeEnd) {
          range.setStart(node, start - nodeStart);
          placedStart = true;
        }
        if (placedStart && !placedEnd && end >= nodeStart && end <= nodeEnd) {
          range.setEnd(node, end - nodeStart);
          placedEnd = true;
          break;
        }
      }
      return placedStart && placedEnd ? range : null;
    };

    if (entities.length > 0) {
      const byType = new Map<string, Range[]>();
      for (const e of entities) {
        const range = rangeFor(e.start, e.end);
        if (!range) continue;
        const list = byType.get(e.type) ?? [];
        list.push(range);
        byType.set(e.type, list);
      }
      for (const [type, ranges] of byType)
        highlights.set(
          HIGHLIGHT_PREFIX + type,
          new Highlight(...(ranges as never[])),
        );
    }

    if (activeProperty && activePropertyStyle) {
      const range = rangeFor(activeProperty.start, activeProperty.end);
      if (range)
        highlights.set(
          activePropertyStyle.highlightKey,
          new Highlight(range as never),
        );
    }
  }, [entities, activeProperty, activePropertyStyle]);

  useEffect(() => {
    paintHighlights();
  }, [paintHighlights, noteText]);

  const entityCounts = entities.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
        <div
          className="notes-paper relative min-h-[280px] flex-1 overflow-y-auto rounded-xl"
          onClick={() => editorRef.current?.focus()}
        >
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            suppressHydrationWarning
            role="textbox"
            aria-multiline="true"
            aria-label="Notes"
            spellCheck={false}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.shiftKey) return;
              const el = e.currentTarget;
              const text = el.textContent ?? "";
              const trimmed = text.trimEnd();
              const isReminder = trimmed.endsWith("*");
              const isContact = trimmed.endsWith("#");
              if (!isReminder && !isContact) return;
              e.preventDefault();

              if (isReminder) {
                const { title, date } = extractReminder(text);
                if (!title) return;
                addReminder(title, date);
                toast.success("Reminder created", {
                  description: [title, date].filter(Boolean).join(" · "),
                });
              } else {
                const draft = extractContact(text);
                if (!draft.name) return;
                addContact(draft);
                toast.success("Contact created", {
                  description: [draft.company, draft.email, draft.phone]
                    .filter(Boolean)
                    .join(" · ") || draft.name,
                });
              }

              el.innerHTML = "";
              setPlain("");
              setNoteText("");
            }}
            onPaste={(e) => {
              // Clean external clipboard HTML so dangerous markup never lands
              // in the editor (and thus never gets persisted or re-rendered).
              const html = e.clipboardData.getData("text/html");
              if (!html) return; // plain-text paste is inert; let it through
              e.preventDefault();
              document.execCommand("insertHTML", false, sanitizeHtml(html));
            }}
            onInput={(e) => {
              const el = e.currentTarget;
              setPlain(el.textContent ?? "");
              setNoteText(el.innerHTML);
            }}
            className="notes-editor min-h-full w-full outline-none"
          />
        </div>

        {showHistory && <CallHistoryPanel entries={callHistory} />}
      </div>

      <footer className="mt-auto flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border pt-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {activePropertyStyle && activeProperty && (
            <button
              onClick={() => {
                const el = editorRef.current;
                if (!el?.textContent?.trim() && !el?.querySelector("img")) return;
                finishCall({
                  html: el.innerHTML,
                  text: plain,
                  property: activeProperty.code,
                  hashtags: Array.from(activeTags),
                });
                el.innerHTML = "";
                setPlain("");
                setActiveTags(new Set());
                toast.success("Call ended", {
                  description: activePropertyStyle.label,
                });
              }}
              aria-label="End call"
              title="End call"
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-primary-foreground transition-opacity hover:opacity-90"
              style={{ backgroundColor: activePropertyStyle.hex, color: activePropertyStyle.fg }}
            >
              <PhoneOff className="size-[15px]" />
            </button>
          )}
          {activePropertyStyle ? (
            <>
              {CALL_HASHTAGS.map((tag) => {
                const isActive = activeTags.has(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => toggleTag(tag)}
                    className="rounded-full px-2 py-0.5 text-[10.5px] font-medium transition-colors hover:opacity-80"
                    style={
                      isActive
                        ? {
                            backgroundColor: activePropertyStyle.hex,
                            color: activePropertyStyle.fg,
                          }
                        : {
                            backgroundColor: `${activePropertyStyle.hex}33`,
                            color: activePropertyStyle.hex,
                          }
                    }
                  >
                    {tag}
                  </button>
                );
              })}
            </>
          ) : (
            Object.entries(entityCounts).map(([type, count]) => (
              <span
                key={type}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10.5px] font-medium",
                  ENTITY_STYLES[type as keyof typeof ENTITY_STYLES].className,
                )}
              >
                {ENTITY_STYLES[type as keyof typeof ENTITY_STYLES].label} · {count}
              </span>
            ))
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => {
              const el = editorRef.current;
              if (!el?.textContent?.trim() && !el?.querySelector("img")) return;
              saveNoteToWidget();
              el.innerHTML = "";
              setPlain("");
              toast.success("Note saved");
            }}
            aria-label="Save note"
            title="Save note"
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Save className="size-[15px]" />
          </button>
          <button
            onClick={() => setShowHistory((v) => !v)}
            aria-label="Call history"
            title="Call history"
            className={cn(
              "flex size-8 items-center justify-center rounded-full transition-colors",
              showHistory ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary",
            )}
          >
            <History className="size-[15px]" />
          </button>
        </div>
      </footer>
    </div>
  );
}
