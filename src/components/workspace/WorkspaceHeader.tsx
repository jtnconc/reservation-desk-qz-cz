import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Search, X } from "lucide-react";
import { useWorkspace } from "@/workspace/store";
import { ToolSwitcher } from "@/components/workspace/ToolSwitcher";
import { NotesToolbar } from "@/components/tools/NotesToolbar";
import { QuoteToolbar } from "@/components/tools/QuoteToolbar";
import type { WidgetType } from "@/workspace/types";
import { quoteNumber } from "@/lib/quote-model";
import { cn } from "@/lib/utils";

const stripHtml = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

interface SearchHit {
  key: string;
  group: string;
  text: string;
  onOpen: () => void;
}

interface WorkspaceHeaderProps {
  quotePreview: boolean;
  onToggleQuotePreview: () => void;
  quoteHistoryOpen: boolean;
  onToggleQuoteHistory: () => void;
}

export function WorkspaceHeader({
  quotePreview,
  onToggleQuotePreview,
  quoteHistoryOpen,
  onToggleQuoteHistory,
}: WorkspaceHeaderProps) {
  const {
    mode,
    activeTool,
    widgets,
    openWidget,
    openTool,
    quote,
    quoteHistory,
    loadQuote,
    setSearchQuery,
  } = useWorkspace();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const closeSearch = () => {
    setSearchOpen(false);
    setQuery("");
    setSearchQuery("");
  };

  useEffect(() => {
    if (!searchOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!searchWrapRef.current?.contains(e.target as Node)) closeSearch();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSearch();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchOpen]);

  // Global search: matches notes, reminders, tasks, contacts, information
  // rows and quotations (current + history).
  const hits = useMemo<SearchHit[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: SearchHit[] = [];

    for (const w of widgets) {
      const c = w.content;
      const push = (text: string) => {
        const clean = text.trim();
        if (clean && clean.toLowerCase().includes(q))
          out.push({
            key: `${w.id}:${out.length}`,
            group: w.title,
            text: clean,
            onOpen: () => openWidget(w.id),
          });
      };
      if (c.kind === "reminders" || c.kind === "tasks") {
        c.items.forEach((i) => push(i.title));
      } else if (c.kind === "contacts") {
        c.items.forEach((i) => {
          const hay = [i.name, i.company, i.email, i.phone].filter(Boolean).join(" · ");
          if (hay.toLowerCase().includes(q)) push(hay);
        });
      } else if (c.kind === "information") {
        c.items.forEach((i) => push(`${i.label} ${i.value}`));
      } else if (c.kind === "notes") {
        c.items.forEach((i) => push(stripHtml(i.text)));
      }
    }

    const docs = [quote, ...quoteHistory.filter((h) => h.id !== quote.id)];
    for (const doc of docs) {
      const hay = [doc.recipient, doc.company, doc.guest, quoteNumber(doc)]
        .join(" ")
        .toLowerCase();
      if (hay.includes(q))
        out.push({
          key: `quote:${doc.id}`,
          group: "Quotes",
          text: `${quoteNumber(doc)} · ${doc.recipient || doc.company || "Quotation"}`,
          onOpen: () => {
            if (doc.id !== quote.id) loadQuote(doc.id);
            openTool("quote");
          },
        });
    }
    return out.slice(0, 10);
  }, [query, widgets, quote, quoteHistory, openWidget, openTool, loadQuote]);

  return (
    <header className="relative z-40 w-full shrink-0 bg-transparent">
      <div className="mx-auto flex h-14 w-full max-w-[1240px] flex-row flex-nowrap items-center gap-3 px-5">
        <div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto overflow-y-visible whitespace-nowrap">
          <ToolSwitcher />

          {mode === "tool" && activeTool === "notes" && <NotesToolbar />}
          {mode === "tool" && activeTool === "quote" && (
            <QuoteToolbar
              preview={quotePreview}
              onTogglePreview={onToggleQuotePreview}
              history={quoteHistoryOpen}
              onToggleHistory={onToggleQuoteHistory}
            />
          )}
        </div>

        <div
          ref={searchWrapRef}
          className="relative z-50 ml-auto flex shrink-0 items-center overflow-visible"
        >
          <div className="relative flex items-center overflow-visible">
            <div
              className={cn(
                "flex h-9 items-center overflow-hidden rounded-full border border-border bg-surface shadow-desk transition-all duration-300 ease-out",
                searchOpen ? "w-64" : "w-9",
              )}
            >
              <button
                type="button"
                aria-label={searchOpen ? "Close search" : "Search"}
                onClick={() => {
                  if (searchOpen) {
                    closeSearch();
                  } else {
                    setSearchOpen(true);
                    requestAnimationFrame(() => searchInputRef.current?.focus());
                  }
                }}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <Search className="size-[17px]" />
              </button>
              <input
                ref={searchInputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSearchQuery(e.target.value);
                }}
                placeholder="Search reservations, guests, notes"
                aria-hidden={!searchOpen}
                tabIndex={searchOpen ? 0 : -1}
                className={cn(
                  "min-w-0 flex-1 bg-transparent pr-3 text-sm outline-none transition-opacity placeholder:text-muted-foreground",
                  searchOpen ? "opacity-100 delay-150 duration-200" : "opacity-0",
                )}
              />
              {searchOpen && query.trim() && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setQuery("");
                    setSearchQuery("");
                    searchInputRef.current?.focus();
                  }}
                  className="mr-2 flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {searchOpen && query.trim() && (
              <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 rounded-xl border border-border bg-surface p-2 shadow-lg">
                <div className="max-h-72 overflow-y-auto px-1 pb-1 pt-1">
                  {hits.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-muted-foreground">
                      No results for “{query.trim()}”.
                    </p>
                  ) : (
                    <ul className="space-y-0.5 text-sm">
                      {hits.map((h) => (
                        <li key={h.key}>
                          <button
                            type="button"
                            onClick={() => {
                              h.onOpen();
                              closeSearch();
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-secondary"
                          >
                            <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 flex-1 truncate">{h.text}</span>
                            <span className="label-xs shrink-0">{h.group}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
